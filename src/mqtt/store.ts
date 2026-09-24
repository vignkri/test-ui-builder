import type { ActivationRecord, EventRecord, LegacyResource, Resource } from "../types";
import {
  isAcknowledgement,
  isActivation,
  isEvent,
  isMeasurement,
  isRegister,
  isRegisterEntry,
  isUpdate,
  type AcknowledgementMessage,
  type ActivationMessage,
  type EventMessage,
  type MeasurementMessage,
  type RegisterEntry,
  type UpdateMessage,
} from "./messages";
import { parseTopic, type Zone } from "./topics";

export interface FleetSnapshot {
  resources: Resource[];
  /** Newest first. */
  activations: ActivationRecord[];
  /** Newest first. */
  events: EventRecord[];
  legacy: LegacyResource[];
  messageCount: number;
  lastMessageAt: number | null;
}

const LOG_LIMIT = 500;
const POWER_HISTORY_LIMIT = 30;
const NOTIFY_COALESCE_MS = 50;

function blankResource(id: string, zone: Zone, customer: string, now: number): Resource {
  return {
    id,
    zone,
    customer,
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

function payloadResourceId(v: unknown): string | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const id = o.resourceId ?? o.resource_id;
  return typeof id === "string" ? id : null;
}

/**
 * Pure reducer over MQTT traffic on `{zone}/{customer}/v2/#` (and v1, which is only noted).
 * A resource appears the first time any message names it; registration fills in its envelope.
 */
export class FleetStore {
  private resources = new Map<string, Resource>();
  private activations: ActivationRecord[] = [];
  private activationsById = new Map<string, ActivationRecord>();
  private events: EventRecord[] = [];
  private legacy = new Map<string, LegacyResource>();
  private messageCount = 0;
  private lastMessageAt: number | null = null;
  private listeners = new Set<() => void>();
  private snapshot: FleetSnapshot = {
    resources: [],
    activations: [],
    events: [],
    legacy: [],
    messageCount: 0,
    lastMessageAt: null,
  };
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

    if (t.version === "v1") {
      const id = t.resourceId ?? payloadResourceId(payload);
      if (id) this.legacy.set(id, { resourceId: id, zone: t.zone, channel: `v1/${t.channel.split("/")[0]}`, lastSeenAt: receivedAt });
      this.scheduleNotify();
      return;
    }

    const { zone, customer } = t;
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
        if (isMeasurement(payload)) this.measure(zone, customer, payload, receivedAt);
        break;
      case "events":
        if (isEvent(payload)) this.event(zone, customer, payload, receivedAt);
        break;
      case "activation":
        if (isActivation(payload)) this.activate(zone, customer, payload, receivedAt);
        break;
      case "acknowledgement":
        if (isAcknowledgement(payload)) this.acknowledge(zone, customer, payload, receivedAt);
        break;
    }
    this.scheduleNotify();
  }

  private touch(id: string, zone: Zone, customer: string, now: number): Resource {
    let r = this.resources.get(id);
    if (!r) {
      r = blankResource(id, zone, customer, now);
      this.resources.set(id, r);
    }
    r.lastMessageAt = now;
    // A resource that now speaks v2 has migrated.
    this.legacy.delete(id);
    return r;
  }

  private register(zone: Zone, customer: string, e: RegisterEntry, at: number, now: number): void {
    const r = this.touch(e.resourceId, zone, customer, now);
    r.type = e.resourceType;
    r.subscriptionStatus = e.subscriptionStatus;
    r.maxImportKw = e.maxImportKw;
    r.maxExportKw = e.maxExportKw;
    r.controlGranularity = e.controlGranularity;
    r.marketRelationships = e.marketRelationships ?? {};
    r.configuration = e.configuration ?? {};
    r.registeredAt = at;
  }

  private update(zone: Zone, customer: string, m: UpdateMessage, now: number): void {
    const r = this.touch(m.resourceId, zone, customer, now);
    if (m.subscriptionStatus) r.subscriptionStatus = m.subscriptionStatus;
    if (typeof m.maxImportKw === "number") r.maxImportKw = m.maxImportKw;
    if (typeof m.maxExportKw === "number") r.maxExportKw = m.maxExportKw;
    if (m.controlGranularity) r.controlGranularity = m.controlGranularity;
    if (m.marketRelationships) r.marketRelationships = m.marketRelationships;
    // configuration is replaced as a whole, never merged.
    if (m.configuration) r.configuration = m.configuration;
    r.updatedAt = m.timestamp ?? now;
  }

  private measure(zone: Zone, customer: string, m: MeasurementMessage, now: number): void {
    const r = this.touch(m.resourceId, zone, customer, now);
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

  private event(zone: Zone, customer: string, m: EventMessage, now: number): void {
    const r = this.touch(m.resourceId, zone, customer, now);
    const record: EventRecord = {
      messageId: m.messageId,
      resourceId: m.resourceId,
      zone,
      eventKind: m.eventKind,
      previousState: r.state,
      resourceState: m.resourceState,
      severity: m.severity,
      sessionState: m.sessionState ?? null,
      code: m.code ?? null,
      description: m.description ?? null,
      resourceTimestamp: m.resourceTimestamp,
      serverTimestamp: m.serverTimestamp,
      receivedAt: now,
      lastWill: m.code === "ConnectionLost" && m.resourceTimestamp === null,
      raw: m,
    };
    r.state = m.resourceState;
    if (m.sessionState !== undefined) r.sessionState = m.sessionState;
    r.lastEvent = record;
    if (m.eventKind === "Error") r.fault = record;
    else if (m.resourceState !== "Faulted") r.fault = null;
    this.events.unshift(record);
    if (this.events.length > LOG_LIMIT) this.events.length = LOG_LIMIT;
  }

  private activate(zone: Zone, customer: string, m: ActivationMessage, now: number): void {
    // QoS 1 can redeliver the same command after a reconnect.
    if (this.activationsById.has(m.messageId)) return;
    const r = this.touch(m.resourceId, zone, customer, now);
    const record: ActivationRecord = {
      messageId: m.messageId,
      resourceId: m.resourceId,
      zone,
      command: m.activation,
      setpointKw: m.activation === "Setpoint" ? m.setpoint : null,
      endsAt: m.activation === "Setpoint" ? m.endsAt : null,
      serverTimestamp: m.serverTimestamp,
      receivedAt: now,
      appliedKw: null,
      ack: null,
      raw: m,
    };
    if (!r.command || record.serverTimestamp >= r.command.serverTimestamp) r.command = record;
    this.activationsById.set(m.messageId, record);
    this.activations.unshift(record);
    if (this.activations.length > LOG_LIMIT) {
      const dropped = this.activations.pop();
      if (dropped) this.activationsById.delete(dropped.messageId);
    }
  }

  private acknowledge(zone: Zone, customer: string, m: AcknowledgementMessage, now: number): void {
    this.touch(m.resourceId, zone, customer, now);
    const a = this.activationsById.get(m.activationId);
    if (!a) return;
    a.ack = {
      messageId: m.messageId,
      acceptance: m.acceptance,
      reason: m.reason ?? null,
      executedAt: m.executedAt,
      latencyMs: m.executedAt === null ? null : m.executedAt - a.serverTimestamp,
      receivedAt: now,
      raw: m,
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
        legacy: [...this.legacy.values()].sort((a, b) => a.resourceId.localeCompare(b.resourceId)),
        messageCount: this.messageCount,
        lastMessageAt: this.lastMessageAt,
      };
      for (const l of this.listeners) l();
    }, NOTIFY_COALESCE_MS);
  }
}
