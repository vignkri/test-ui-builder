import type { FeedEntry, Resource, ResourceType } from "../types";
import { healthOf } from "./derive";
import {
  isEvAcknowledgement,
  isEvActivation,
  isEvPower,
  isEvRegister,
  isEvStatus,
  isEvUpdate,
  isHpActivation,
  isHpEvent,
  isHpMeasurement,
  isHpRegister,
  type EvAcknowledgementMessage,
  type EvActivationMessage,
  type EvRegisterMessage,
  type HpActivationMessage,
  type HpRegisterEntry,
} from "./messages";
import { parseTopic, type Channel, type ParsedTopic, type Zone } from "./topics";

export interface FleetSnapshot {
  resources: Resource[];
  feed: FeedEntry[];
  messageCount: number;
  lastMessageAt: number | null;
}

const FEED_LIMIT = 60;
const POWER_HISTORY_LIMIT = 20;
const NOTIFY_COALESCE_MS = 50;

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mapPositionFor(id: string): { x: number; y: number } {
  const h = hashId(id);
  return { x: 0.08 + ((h & 0xffff) / 0xffff) * 0.84, y: 0.08 + ((h >>> 16) / 0xffff) * 0.84 };
}

function blankResource(id: string, type: ResourceType, zone: Zone, customer: string, now: number): Resource {
  return {
    id,
    type,
    zone,
    customer,
    subscriptionStatus: "Subscribed",
    capability: [],
    currentType: null,
    schedule: null,
    brpCode: null,
    compressorRatedPowerKW: null,
    backupHeaterRatedPowerKW: null,
    status: null,
    powerKw: null,
    powerHistoryKw: [],
    availableUpKw: null,
    availableDownKw: null,
    activation: null,
    acknowledgement: null,
    ackPending: false,
    registeredAt: now,
    lastMessageAt: now,
    mapPosition: mapPositionFor(id),
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
 * Pure reducer over MQTT traffic. Feed it every message on `{zone}/{customer}/v1/#`
 * and it maintains the fleet the UI renders. Both the live broker connection and the
 * in-browser simulator go through `apply`, so the UI never sees a different data path.
 */
export class FleetStore {
  private resources = new Map<string, Resource>();
  private feed: FeedEntry[] = [];
  private messageCount = 0;
  private lastMessageAt: number | null = null;
  private listeners = new Set<() => void>();
  private snapshot: FleetSnapshot = { resources: [], feed: [], messageCount: 0, lastMessageAt: null };
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
    const parsed = parseTopic(topic);
    if (!parsed) return;
    const payload = decode(rawPayload);
    if (payload === null) return;

    this.messageCount++;
    this.lastMessageAt = receivedAt;

    if (parsed.bulk) {
      if (Array.isArray(payload)) {
        for (const entry of payload) this.applyOne(parsed, entry, receivedAt);
      } else {
        this.applyOne(parsed, payload, receivedAt);
      }
    } else {
      this.applyOne(parsed, payload, receivedAt);
    }
    this.scheduleNotify();
  }

  private applyOne(t: ParsedTopic, payload: unknown, now: number): void {
    switch (t.channel) {
      case "register":
        if (isEvRegister(payload)) this.registerEv(t, payload, now);
        else if (isHpRegister(payload)) {
          for (const entry of payload.payload) this.registerHp(t, entry, now);
        }
        return;
      case "power":
        if (isEvPower(payload)) {
          const r = this.touch(payload.resource_id, "ev-charger", t, now);
          r.powerKw = payload.power_kw;
          r.powerHistoryKw = [...r.powerHistoryKw.slice(-(POWER_HISTORY_LIMIT - 1)), payload.power_kw];
          this.pushFeed(r, t.channel, `${payload.power_kw.toFixed(1)} kW`, now);
        }
        return;
      case "status":
        if (isEvStatus(payload)) {
          const r = this.touch(payload.resource_id, "ev-charger", t, now);
          r.status = payload.status;
          this.pushFeed(r, t.channel, payload.status, now);
        }
        return;
      case "activation":
        if (isEvActivation(payload)) this.activateEv(t, payload, now);
        else if (isHpActivation(payload) && t.resourceId) this.activateHp(t, t.resourceId, payload, now);
        return;
      case "acknowledgement":
        if (isEvAcknowledgement(payload)) this.acknowledge(t, payload, now);
        return;
      case "update":
        if (isEvUpdate(payload)) {
          const r = this.touch(payload.resource_id, "ev-charger", t, now);
          if (payload.data.capability) r.capability = payload.data.capability;
          if (payload.data.subscription_status) r.subscriptionStatus = payload.data.subscription_status;
          if (payload.data.schedule !== undefined) r.schedule = payload.data.schedule;
          this.pushFeed(r, t.channel, Object.keys(payload.data).join(", "), now);
        }
        return;
      case "measurement":
        if (isHpMeasurement(payload) && t.resourceId) {
          const r = this.touch(t.resourceId, "heat-pump", t, now);
          r.availableUpKw = payload.availableUpKw;
          r.availableDownKw = payload.availableDownKw;
          this.pushFeed(
            r,
            t.channel,
            `↑${payload.availableUpKw.toFixed(1)} / ↓${payload.availableDownKw.toFixed(1)} kW`,
            now
          );
        }
        return;
      case "event":
        if (isHpEvent(payload) && t.resourceId) {
          const r = this.touch(t.resourceId, "heat-pump", t, now);
          r.status = payload.status;
          this.pushFeed(r, t.channel, `${payload.eventKind} ${payload.status}`, now);
        }
        return;
      case "schedules":
        return;
    }
  }

  private touch(id: string, type: ResourceType, t: ParsedTopic, now: number): Resource {
    let r = this.resources.get(id);
    if (!r) {
      r = blankResource(id, type, t.zone, t.customer, now);
      this.resources.set(id, r);
    }
    r.lastMessageAt = now;
    return r;
  }

  private registerEv(t: ParsedTopic, m: EvRegisterMessage, now: number): void {
    const r = this.touch(m.resource_id, "ev-charger", t, now);
    r.capability = m.capability;
    r.currentType = m.current_type;
    r.subscriptionStatus = m.subscription_status;
    r.schedule = m.schedule;
    r.brpCode = m.market_relationships?.balance_responsible_party?.code ?? null;
    r.registeredAt = m.timestamp ?? now;
    this.pushFeed(r, "register", `capability ${m.capability.join(", ")}`, now);
  }

  private registerHp(t: ParsedTopic, e: HpRegisterEntry, now: number): void {
    const r = this.touch(e.resourceId, "heat-pump", t, now);
    r.zone = e.priceZone;
    r.subscriptionStatus = e.subscriptionStatus;
    r.compressorRatedPowerKW = e.configuration.compressorRatedPowerKW;
    r.backupHeaterRatedPowerKW = e.configuration.backupHeaterRatedPowerKW;
    this.pushFeed(r, "register", `compressor ${e.configuration.compressorRatedPowerKW} kW`, now);
  }

  private activateEv(t: ParsedTopic, m: EvActivationMessage, now: number): void {
    const r = this.touch(m.resource_id, "ev-charger", t, now);
    r.activation =
      m.activation === "ClearPowerLimit"
        ? null
        : {
            kind: m.activation,
            powerLimitKw: m.power_limit_kw ?? null,
            endsAt: m.ends_at,
            sentAt: m.timestamp,
            eventId: m.event_id,
          };
    r.ackPending = true;
    const label =
      m.activation === "SetPowerLimit" ? `SetPowerLimit ${(m.power_limit_kw ?? 0).toFixed(1)} kW` : m.activation;
    this.pushFeed(r, "activation", label, now);
  }

  private activateHp(t: ParsedTopic, id: string, m: HpActivationMessage, now: number): void {
    const r = this.touch(id, "heat-pump", t, now);
    const { activation, timestamp, endsAt } = m.payload;
    r.activation =
      activation === "Release"
        ? null
        : { kind: activation, powerLimitKw: null, endsAt, sentAt: timestamp, eventId: null };
    this.pushFeed(r, "activation", activation, now);
  }

  private acknowledge(t: ParsedTopic, m: EvAcknowledgementMessage, now: number): void {
    const r = this.touch(m.resource_id, "ev-charger", t, now);
    r.ackPending = false;
    r.acknowledgement = {
      acceptance: m.acceptance,
      roundTripMs: m.executed_at !== null ? m.executed_at - m.sent_at : null,
      at: m.timestamp,
    };
    const rt = r.acknowledgement.roundTripMs;
    this.pushFeed(r, "acknowledgement", rt === null ? m.acceptance : `${m.acceptance} · ${rt} ms`, now);
  }

  private pushFeed(r: Resource, channel: Channel, summary: string, now: number): void {
    this.feed.unshift({
      id: `${r.id}-${now}-${this.messageCount}`,
      resourceId: r.id,
      resourceType: r.type,
      channel,
      summary,
      at: now,
      health: healthOf(r, now),
    });
    if (this.feed.length > FEED_LIMIT) this.feed.length = FEED_LIMIT;
  }

  private scheduleNotify(): void {
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      this.snapshot = {
        resources: [...this.resources.values()].map((r) => ({ ...r })).sort((a, b) => a.id.localeCompare(b.id)),
        feed: [...this.feed],
        messageCount: this.messageCount,
        lastMessageAt: this.lastMessageAt,
      };
      for (const l of this.listeners) l();
    }, NOTIFY_COALESCE_MS);
  }
}
