import type { ActivationRecord, EventRecord, Resource } from "../types";
import {
  isAcknowledgement,
  isActivation,
  isEvent,
  isMeasurement,
  isRegister,
  isRegisterEntry,
  isUpdate,
  type Acceptance,
  type EventKind,
  type MeasurementType,
  type RegisterEntry,
  type ResourceState,
  type Severity,
  type UpdateMessage,
} from "./messages";
import { parseTopic, type ApiVersion, type Zone } from "./topics";
import { translateV1, type V1EvActivation, type V1HpActivation, type V1Op } from "./v1";

export interface FleetSnapshot {
  resources: Resource[];
  /** Newest first. */
  activations: ActivationRecord[];
  /** Newest first. */
  events: EventRecord[];
  messageCount: number;
  lastMessageAt: number | null;
}

const LOG_LIMIT = 500;
const POWER_HISTORY_LIMIT = 30;
const NOTIFY_COALESCE_MS = 50;

// Version-neutral inputs: v2 messages map onto these directly, v1 through translateV1.

interface MeasurementInput {
  resourceId: string;
  measurementType: MeasurementType;
  value: number;
  resourceTimestamp: number | null;
  serverTimestamp: number;
}

interface EventInput {
  messageId: string;
  resourceId: string;
  eventKind: EventKind;
  resourceState: ResourceState;
  /** v1 OCPP session states: keep an Activated resource Activated. */
  sessionOnly: boolean;
  severity: Severity;
  sessionState: string | null;
  code: string | null;
  description: string | null;
  resourceTimestamp: number | null;
  serverTimestamp: number;
  raw: object;
}

interface ActivationInput {
  messageId: string;
  resourceId: string;
  command: "Setpoint" | "Release";
  v1Command: V1EvActivation | V1HpActivation | null;
  setpointKw: number | null;
  endsAt: number | null;
  serverTimestamp: number;
  raw: object;
}

interface AckInput {
  messageId: string;
  resourceId: string;
  /** v2 names the activation by id; v1 only by the time it was sent. */
  activationId: string | null;
  sentAt: number | null;
  acceptance: Acceptance;
  reason: string | null;
  executedAt: number | null;
  raw: object;
}

function blankResource(id: string, zone: Zone, customer: string, version: ApiVersion, now: number): Resource {
  return {
    id,
    zone,
    customer,
    apiVersion: version,
    v1: null,
    type: null,
    subscriptionStatus: "Subscribed",
    maxImportKw: null,
    maxExportKw: null,
    controlGranularity: null,
    marketRelationships: {},
    configuration: {},
    registeredAt: null,
    updatedAt: null,
    metrics: {},
    powerHistoryKw: [],
    state: null,
    sessionState: null,
    lastEvent: null,
    fault: null,
    command: null,
    lastMessageAt: now,
    lastSampleAt: null,
  };
}

function decode(payload: Uint8Array | string | object): unknown {
  if (typeof payload === "object" && !(payload instanceof Uint8Array)) return payload;
  const text = typeof payload === "string" ? payload : new TextDecoder().decode(payload);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Pure reducer over MQTT traffic on `{zone}/{customer}/v2/#` and `…/v1/#`. Both versions land in
 * one model: v1 payloads are translated at the boundary (see v1.ts). A resource appears the first
 * time any message names it; registration fills in its envelope.
 */
export class FleetStore {
  private resources = new Map<string, Resource>();
  private activations: ActivationRecord[] = [];
  private activationsById = new Map<string, ActivationRecord>();
  private events: EventRecord[] = [];
  private messageCount = 0;
  private lastMessageAt: number | null = null;
  private listeners = new Set<() => void>();
  private snapshot: FleetSnapshot = { resources: [], activations: [], events: [], messageCount: 0, lastMessageAt: null };
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): FleetSnapshot => this.snapshot;

  get(id: string): Resource | undefined {
    return this.resources.get(id);
  }

  apply(topic: string, rawPayload: Uint8Array | string | object, receivedAt: number = Date.now()): void {
    const t = parseTopic(topic);
    if (!t) return;
    const payload = decode(rawPayload);
    if (payload === null) return;

    this.messageCount++;
    this.lastMessageAt = receivedAt;
    const { zone, customer } = t;

    if (t.version === "v1") {
      for (const op of translateV1(t.channel, payload, t.resourceId, receivedAt)) this.applyV1(zone, customer, op, receivedAt);
      this.scheduleNotify();
      return;
    }

    switch (t.channel) {
      case "register":
        if (isRegister(payload)) {
          for (const entry of payload.resources) {
            if (isRegisterEntry(entry)) this.register(zone, customer, entry, payload.timestamp ?? receivedAt, receivedAt);
          }
        }
        break;
      case "update":
        if (isUpdate(payload) && payload.resourceId === t.resourceId) this.update(zone, customer, payload, receivedAt);
        break;
      case "measurements":
        if (isMeasurement(payload)) this.measure(zone, customer, "v2", payload, receivedAt);
        break;
      case "events":
        if (isEvent(payload)) {
          this.event(zone, customer, "v2", {
            ...payload,
            sessionOnly: false,
            sessionState: payload.sessionState ?? null,
            code: payload.code ?? null,
            description: payload.description ?? null,
            raw: payload,
          }, receivedAt);
        }
        break;
      case "activation":
        if (isActivation(payload)) {
          const set = payload.activation === "Setpoint";
          this.activate(zone, customer, "v2", {
            messageId: payload.messageId,
            resourceId: payload.resourceId,
            command: payload.activation,
            v1Command: null,
            setpointKw: set ? payload.setpoint : null,
            endsAt: set ? payload.endsAt : null,
            serverTimestamp: payload.serverTimestamp,
            raw: payload,
          }, receivedAt);
        }
        break;
      case "acknowledgement":
        if (isAcknowledgement(payload)) {
          this.acknowledge(zone, customer, "v2", {
            messageId: payload.messageId,
            resourceId: payload.resourceId,
            activationId: payload.activationId,
            sentAt: null,
            acceptance: payload.acceptance,
            reason: payload.reason ?? null,
            executedAt: payload.executedAt,
            raw: payload,
          }, receivedAt);
        }
        break;
    }
    this.scheduleNotify();
  }

  private applyV1(zone: Zone, customer: string, op: V1Op, now: number): void {
    switch (op.kind) {
      case "register": {
        const r = this.touch(op.resourceId, zone, customer, "v1", now);
        // A resource registered on both versions is described by its v2 declaration.
        if (r.apiVersion === "v2") return;
        r.type = op.resourceType;
        r.subscriptionStatus = op.subscriptionStatus;
        r.configuration = op.configuration;
        r.marketRelationships = op.marketRelationships;
        r.v1 = op.v1;
        r.registeredAt = op.timestamp ?? now;
        return;
      }
      case "update": {
        const r = this.touch(op.resourceId, zone, customer, "v1", now);
        if (r.apiVersion === "v2") return;
        if (op.subscriptionStatus) r.subscriptionStatus = op.subscriptionStatus;
        if (op.capability || op.schedule !== undefined) {
          r.v1 = {
            capability: op.capability ?? r.v1?.capability ?? [],
            schedule: op.schedule !== undefined ? op.schedule : (r.v1?.schedule ?? null),
          };
        }
        r.updatedAt = now;
        return;
      }
      case "measurement":
        this.measure(zone, customer, "v1", op, now);
        return;
      case "event":
        this.event(zone, customer, "v1", { ...op, description: null }, now);
        return;
      case "activation":
        this.activate(zone, customer, "v1", op, now);
        return;
      case "acknowledgement":
        this.acknowledge(zone, customer, "v1", { ...op, activationId: null }, now);
        return;
    }
  }

  private touch(id: string, zone: Zone, customer: string, version: ApiVersion, now: number): Resource {
    let r = this.resources.get(id);
    if (!r) {
      r = blankResource(id, zone, customer, version, now);
      this.resources.set(id, r);
    }
    // Migration is one-way: once a resource speaks v2 it is a v2 resource.
    if (version === "v2") r.apiVersion = "v2";
    r.lastMessageAt = now;
    return r;
  }

  private register(zone: Zone, customer: string, e: RegisterEntry, at: number, now: number): void {
    const r = this.touch(e.resourceId, zone, customer, "v2", now);
    r.type = e.resourceType;
    r.subscriptionStatus = e.subscriptionStatus;
    r.maxImportKw = e.maxImportKw;
    r.maxExportKw = e.maxExportKw;
    r.controlGranularity = e.controlGranularity;
    r.marketRelationships = e.marketRelationships ?? {};
    r.configuration = e.configuration ?? {};
    r.v1 = null;
    r.registeredAt = at;
  }

  private update(zone: Zone, customer: string, m: UpdateMessage, now: number): void {
    const r = this.touch(m.resourceId, zone, customer, "v2", now);
    if (m.subscriptionStatus) r.subscriptionStatus = m.subscriptionStatus;
    if (typeof m.maxImportKw === "number") r.maxImportKw = m.maxImportKw;
    if (typeof m.maxExportKw === "number") r.maxExportKw = m.maxExportKw;
    if (m.controlGranularity) r.controlGranularity = m.controlGranularity;
    if (m.marketRelationships) r.marketRelationships = m.marketRelationships;
    // configuration is replaced as a whole, never merged.
    if (m.configuration) r.configuration = m.configuration;
    r.updatedAt = m.timestamp ?? now;
  }

  private measure(zone: Zone, customer: string, version: ApiVersion, m: MeasurementInput, now: number): void {
    const r = this.touch(m.resourceId, zone, customer, version, now);
    r.metrics = {
      ...r.metrics,
      [m.measurementType]: {
        value: m.value,
        resourceTimestamp: m.resourceTimestamp,
        serverTimestamp: m.serverTimestamp,
        receivedAt: now,
      },
    };
    r.lastSampleAt = now;
    if (m.measurementType === "measuredPower") {
      r.powerHistoryKw = [...r.powerHistoryKw.slice(-(POWER_HISTORY_LIMIT - 1)), m.value];
      const c = r.command;
      if (c && c.command === "Setpoint" && c.appliedKw === null && m.serverTimestamp >= c.serverTimestamp) {
        c.appliedKw = m.value;
      }
    }
  }

  private event(zone: Zone, customer: string, version: ApiVersion, m: EventInput, now: number): void {
    const r = this.touch(m.resourceId, zone, customer, version, now);
    const resourceState = m.sessionOnly && r.state === "Activated" ? "Activated" : m.resourceState;
    const record: EventRecord = {
      messageId: m.messageId,
      resourceId: m.resourceId,
      zone,
      eventKind: m.eventKind,
      previousState: r.state,
      resourceState,
      severity: m.severity,
      sessionState: m.sessionState,
      code: m.code,
      description: m.description,
      resourceTimestamp: m.resourceTimestamp,
      serverTimestamp: m.serverTimestamp,
      receivedAt: now,
      lastWill: m.code === "ConnectionLost" && m.resourceTimestamp === null,
      raw: m.raw,
    };
    r.state = resourceState;
    if (m.sessionState !== null) r.sessionState = m.sessionState;
    r.lastEvent = record;
    if (m.eventKind === "Error") r.fault = record;
    else if (resourceState !== "Faulted") r.fault = null;
    this.events.unshift(record);
    if (this.events.length > LOG_LIMIT) this.events.length = LOG_LIMIT;
  }

  private activate(zone: Zone, customer: string, version: ApiVersion, m: ActivationInput, now: number): void {
    // QoS 1 can redeliver the same command after a reconnect.
    if (this.activationsById.has(m.messageId)) return;
    const r = this.touch(m.resourceId, zone, customer, version, now);
    const record: ActivationRecord = { ...m, zone, receivedAt: now, appliedKw: null, ack: null };
    if (!r.command || record.serverTimestamp >= r.command.serverTimestamp) r.command = record;
    this.activationsById.set(m.messageId, record);
    this.activations.unshift(record);
    if (this.activations.length > LOG_LIMIT) {
      const dropped = this.activations.pop();
      if (dropped) this.activationsById.delete(dropped.messageId);
    }
  }

  /** v1 acknowledgements carry sent_at instead of an id: match the resource's command sent then. */
  private findV1Activation(resourceId: string, sentAt: number | null): ActivationRecord | undefined {
    const open = this.activations.filter((a) => a.resourceId === resourceId && !a.ack);
    return (sentAt !== null ? open.find((a) => a.serverTimestamp === sentAt) : undefined) ?? open[0];
  }

  private acknowledge(zone: Zone, customer: string, version: ApiVersion, m: AckInput, now: number): void {
    this.touch(m.resourceId, zone, customer, version, now);
    const a = m.activationId ? this.activationsById.get(m.activationId) : this.findV1Activation(m.resourceId, m.sentAt);
    if (!a) return;
    a.ack = {
      messageId: m.messageId,
      acceptance: m.acceptance,
      reason: m.reason,
      executedAt: m.executedAt,
      latencyMs: m.executedAt === null ? null : m.executedAt - a.serverTimestamp,
      receivedAt: now,
      raw: m.raw,
    };
  }

  private scheduleNotify(): void {
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      // Records are mutated in place (an ack joins its activation), so copy them for React.
      const activationCopies = new Map(this.activations.map((a) => [a.messageId, { ...a }]));
      this.snapshot = {
        resources: [...this.resources.values()]
          .map((r) => ({ ...r, command: r.command ? (activationCopies.get(r.command.messageId) ?? { ...r.command }) : null }))
          .sort((a, b) => a.id.localeCompare(b.id)),
        // Newest first by the platform's own clock; QoS 1 redelivery can reorder arrival.
        activations: [...activationCopies.values()].sort((a, b) => b.serverTimestamp - a.serverTimestamp),
        events: [...this.events].sort((a, b) => b.serverTimestamp - a.serverTimestamp),
        messageCount: this.messageCount,
        lastMessageAt: this.lastMessageAt,
      };
      for (const l of this.listeners) l();
    }, NOTIFY_COALESCE_MS);
  }
}
