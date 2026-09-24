/**
 * The deprecated v1 EV charger and heat pump APIs, translated into the v2 model the console
 * renders. Every mapping follows https://connect.gridhub.ai/distributed-resources/migration —
 * the hazards it names are applied here, once, so no screen has to know about v1 field names.
 */
import type { Acceptance, Configuration, MarketRelationships, ResourceState, Severity } from "./messages";
import type { V1Channel } from "./topics";

// ---------- v1 payloads (EV chargers: snake_case; heat pumps: camelCase, nested payload) ----------

export const V1_EV_STATUSES = [
  "Available",
  "Preparing",
  "Charging",
  "SuspendedEV",
  "SuspendedEVSE",
  "Reserved",
  "Unavailable",
  "Faulted",
  "Offline",
] as const;

export const V1_EV_ACCEPTANCES = [
  "Accepted",
  "RejectedByEvse",
  "EvseOffline",
  "EvDisconnected",
  "NoEvCharging",
  "InvalidEvseId",
  "InvalidMessageFormat",
  "InternalError",
  "Unauthorised",
] as const;
type V1EvAcceptance = (typeof V1_EV_ACCEPTANCES)[number];

export type V1EvActivation = "SetPowerLimit" | "ClearPowerLimit";
export type V1HpActivation = "ActivationUp" | "ActivationDown" | "Release";

export interface V1Schedule {
  starts_at: string;
  ends_at: string;
}

interface EvRegister {
  timestamp?: number;
  event_id?: string;
  resource_id: string;
  capability: string[];
  current_type?: "AC" | "DC";
  subscription_status?: "Subscribed" | "Unsubscribed";
  schedule?: V1Schedule | null;
  market_relationships?: {
    balance_responsible_party?: { code: string; encoding: "GS1" };
    retailer?: { code: string; encoding: "GS1" };
  };
}

interface HpRegister {
  eventId?: string;
  timestamp?: number;
  payload: {
    resourceId: string;
    subscriptionStatus?: "Subscribed" | "Unsubscribed";
    configuration?: { compressorRatedPowerKW?: number; backupHeaterRatedPowerKW?: number };
  }[];
}

// ---------- what the translator hands the store ----------

/** v1-only declarations, kept for the Registration screen; both are removed in v2. */
export interface V1Declaration {
  capability: string[];
  schedule: V1Schedule | null;
}

export type V1Op =
  | {
      kind: "register";
      resourceId: string;
      resourceType: "evCharger" | "heatPump";
      subscriptionStatus: "Subscribed" | "Unsubscribed";
      configuration: Configuration;
      marketRelationships: MarketRelationships;
      v1: V1Declaration | null;
      timestamp: number | null;
    }
  | {
      kind: "update";
      resourceId: string;
      subscriptionStatus?: "Subscribed" | "Unsubscribed";
      capability?: string[];
      schedule?: V1Schedule | null;
    }
  | {
      kind: "measurement";
      resourceId: string;
      measurementType: "measuredPower" | "availablePowerUp" | "availablePowerDown";
      value: number;
      resourceTimestamp: number | null;
      serverTimestamp: number;
    }
  | {
      kind: "event";
      messageId: string;
      resourceId: string;
      eventKind: "Status" | "Error";
      resourceState: ResourceState;
      /** An OCPP session state arrived: keep an Activated resource Activated. */
      sessionOnly: boolean;
      severity: Severity;
      sessionState: string | null;
      code: string | null;
      resourceTimestamp: number | null;
      serverTimestamp: number;
      raw: object;
    }
  | {
      kind: "activation";
      messageId: string;
      resourceId: string;
      command: "Setpoint" | "Release";
      v1Command: V1EvActivation | V1HpActivation;
      setpointKw: number | null;
      endsAt: number | null;
      serverTimestamp: number;
      raw: object;
    }
  | {
      kind: "acknowledgement";
      messageId: string;
      resourceId: string;
      acceptance: Acceptance;
      reason: string | null;
      /** v1 names the activation by its send time, not its id. */
      sentAt: number | null;
      executedAt: number | null;
      raw: object;
    };

// ---------- mapping tables from the migration guide ----------

/** v1 EV acceptance → v2 acceptance and reason. */
const ACCEPTANCE: Record<V1EvAcceptance, [Acceptance, string | null]> = {
  Accepted: ["Accepted", null],
  RejectedByEvse: ["Rejected", null],
  EvseOffline: ["Offline", null],
  EvDisconnected: ["NotAvailable", "No vehicle connected"],
  NoEvCharging: ["NotAvailable", "Vehicle connected but not charging"],
  InvalidEvseId: ["InvalidResourceId", null],
  InvalidMessageFormat: ["InvalidMessageFormat", null],
  InternalError: ["InternalError", null],
  Unauthorised: ["Unauthorised", null],
};

const SESSION_STATES = ["Preparing", "Charging", "SuspendedEV", "SuspendedEVSE", "Reserved"];

// ---------- guards ----------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function has<T extends string>(values: readonly T[], v: unknown): v is T {
  return typeof v === "string" && (values as readonly string[]).includes(v);
}

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

function isEvRegister(v: unknown): v is EvRegister {
  return isObject(v) && typeof v.resource_id === "string" && Array.isArray(v.capability);
}

function isHpRegister(v: unknown): v is HpRegister {
  return isObject(v) && Array.isArray(v.payload);
}

// ---------- translation ----------

/**
 * Translate one v1 message into zero or more store operations. `topicId` is the resourceId
 * from the topic, which heat pump payloads rely on because they don't repeat it.
 */
export function translateV1(channel: V1Channel, payload: unknown, topicId: string | null, receivedAt: number): V1Op[] {
  // Bulk topics carry arrays of the per-resource payload.
  if (Array.isArray(payload)) return payload.flatMap((p) => translateV1(channel, p, topicId, receivedAt));
  if (!isObject(payload)) return [];
  const p = payload;

  switch (channel) {
    case "register": {
      if (isEvRegister(p)) {
        const mr = p.market_relationships;
        return [
          {
            kind: "register",
            resourceId: p.resource_id,
            resourceType: "evCharger",
            subscriptionStatus: p.subscription_status ?? "Subscribed",
            configuration: p.current_type ? { currentType: p.current_type } : {},
            marketRelationships: {
              balanceResponsibleParty: mr?.balance_responsible_party,
              retailer: mr?.retailer,
            },
            v1: { capability: p.capability, schedule: p.schedule ?? null },
            timestamp: num(p.timestamp),
          },
        ];
      }
      if (isHpRegister(p)) {
        return p.payload
          .filter((e) => isObject(e) && typeof e.resourceId === "string")
          .map((e) => ({
            kind: "register" as const,
            resourceId: e.resourceId,
            resourceType: "heatPump" as const,
            subscriptionStatus: e.subscriptionStatus ?? "Subscribed",
            // KW becomes Kw in v2.
            configuration: {
              compressorRatedPowerKw: e.configuration?.compressorRatedPowerKW,
              backupHeaterRatedPowerKw: e.configuration?.backupHeaterRatedPowerKW,
            },
            marketRelationships: {},
            v1: null,
            timestamp: num(p.timestamp),
          }));
      }
      return [];
    }

    case "update": {
      const id = typeof p.resource_id === "string" ? p.resource_id : topicId;
      if (!id || !isObject(p.data)) return [];
      const d = p.data;
      return [
        {
          kind: "update",
          resourceId: id,
          subscriptionStatus: has(["Subscribed", "Unsubscribed"] as const, d.subscription_status) ? d.subscription_status : undefined,
          capability: Array.isArray(d.capability) ? (d.capability as string[]) : undefined,
          schedule: "schedule" in d ? ((d.schedule as V1Schedule | null) ?? null) : undefined,
        },
      ];
    }

    case "power": {
      // Hazard 1: v1 power_kw is positive for consumption; v2 is export-positive.
      const id = typeof p.resource_id === "string" ? p.resource_id : topicId;
      const kw = num(p.power_kw);
      if (!id || kw === null) return [];
      return [
        {
          kind: "measurement",
          resourceId: id,
          measurementType: "measuredPower",
          value: kw === 0 ? 0 : -kw,
          resourceTimestamp: num(p.timestamp_evse),
          serverTimestamp: num(p.timestamp_server) ?? receivedAt,
        },
      ];
    }

    case "measurement": {
      // Hazard 3: availableUpKw is a straight rename. Hazard 2: v1 availableDownKw covers the
      // backup heater alone — shown as published, never recomputed into the v2 quantity.
      if (!topicId) return [];
      const at = { resourceTimestamp: num(p.resourceTimestamp), serverTimestamp: num(p.serverTimestamp) ?? receivedAt };
      const ops: V1Op[] = [];
      const up = num(p.availableUpKw);
      const down = num(p.availableDownKw);
      if (up !== null) ops.push({ kind: "measurement", resourceId: topicId, measurementType: "availablePowerUp", value: up, ...at });
      if (down !== null) ops.push({ kind: "measurement", resourceId: topicId, measurementType: "availablePowerDown", value: down, ...at });
      return ops;
    }

    case "status": {
      const id = typeof p.resource_id === "string" ? p.resource_id : topicId;
      if (!id || !has(V1_EV_STATUSES, p.status)) return [];
      const status = p.status;
      const session = SESSION_STATES.includes(status);
      const resourceState: ResourceState =
        status === "Faulted" ? "Faulted" : status === "Offline" || status === "Unavailable" ? "Unavailable" : "Available";
      const serverTimestamp = num(p.timestamp_server) ?? receivedAt;
      return [
        {
          kind: "event",
          messageId: typeof p.event_id === "string" ? p.event_id : `v1-${id}-${serverTimestamp}`,
          resourceId: id,
          eventKind: status === "Faulted" ? "Error" : "Status",
          resourceState,
          sessionOnly: session,
          severity: status === "Faulted" || status === "Offline" ? "HIGH" : "INFO",
          sessionState: session ? status : null,
          code: status === "Offline" ? "Offline" : null,
          resourceTimestamp: num(p.timestamp_evse),
          serverTimestamp,
          raw: p,
        },
      ];
    }

    case "event": {
      // Heat pump: ActivatedUp and ActivatedDown collapse into Activated.
      if (!topicId || !has(["Available", "Unavailable", "ActivatedUp", "ActivatedDown"] as const, p.status)) return [];
      const kind = p.eventKind === "Error" ? "Error" : "Status";
      const serverTimestamp = num(p.serverTimestamp) ?? receivedAt;
      return [
        {
          kind: "event",
          messageId: typeof p.eventId === "string" ? p.eventId : `v1-${topicId}-${serverTimestamp}`,
          resourceId: topicId,
          eventKind: kind,
          resourceState: p.status === "ActivatedUp" || p.status === "ActivatedDown" ? "Activated" : p.status,
          sessionOnly: false,
          severity: kind === "Error" ? "HIGH" : "INFO",
          sessionState: null,
          code: p.status === "ActivatedUp" || p.status === "ActivatedDown" ? p.status : null,
          resourceTimestamp: num(p.resourceTimestamp),
          serverTimestamp,
          raw: p,
        },
      ];
    }

    case "activation": {
      if (has(["SetPowerLimit", "ClearPowerLimit"] as const, p.activation)) {
        // Hazard 6: SetPowerLimit → Setpoint with a signed magnitude; ClearPowerLimit → Release.
        const id = typeof p.resource_id === "string" ? p.resource_id : topicId;
        if (!id) return [];
        const sent = num(p.timestamp) ?? receivedAt;
        const limit = num(p.power_limit_kw);
        const set = p.activation === "SetPowerLimit";
        return [
          {
            kind: "activation",
            messageId: typeof p.event_id === "string" ? p.event_id : `v1-${id}-${sent}`,
            resourceId: id,
            command: set ? "Setpoint" : "Release",
            v1Command: p.activation,
            setpointKw: set && limit !== null ? -limit : null,
            endsAt: set ? num(p.ends_at) : null,
            serverTimestamp: sent,
            raw: p,
          },
        ];
      }
      const inner = isObject(p.payload) ? p.payload : null;
      if (inner && topicId && has(["ActivationUp", "ActivationDown", "Release"] as const, inner.activation)) {
        // Hazard 5: directional, no magnitude. Up sheds consumption; Down engages the heater.
        const sent = num(inner.timestamp) ?? receivedAt;
        return [
          {
            kind: "activation",
            messageId: `v1-${topicId}-${sent}`,
            resourceId: topicId,
            command: inner.activation === "Release" ? "Release" : "Setpoint",
            v1Command: inner.activation,
            setpointKw: null,
            endsAt: inner.activation === "Release" ? null : num(inner.endsAt),
            serverTimestamp: sent,
            raw: p,
          },
        ];
      }
      return [];
    }

    case "acknowledgement": {
      // EV chargers only — v1 heat pumps never acknowledge.
      const id = typeof p.resource_id === "string" ? p.resource_id : topicId;
      if (!id || !has(V1_EV_ACCEPTANCES, p.acceptance)) return [];
      const [acceptance, reason] = ACCEPTANCE[p.acceptance];
      return [
        {
          kind: "acknowledgement",
          messageId: typeof p.event_id === "string" ? p.event_id : `v1-ack-${id}-${receivedAt}`,
          resourceId: id,
          acceptance,
          reason,
          sentAt: num(p.sent_at),
          executedAt: num(p.executed_at),
          raw: p,
        },
      ];
    }

    // v1/schedules/zonal was removed in v2: forward availability is not a dispatch input.
    case "schedules":
      return [];
  }
}

// ---------- publishing ----------

export function v1EvActivation(resourceId: string, activation: V1EvActivation, messageId: string, now: number, holdMs: number, limitKw?: number): object {
  return {
    event_id: messageId,
    resource_id: resourceId,
    activation,
    timestamp: now,
    ...(activation === "SetPowerLimit" ? { power_limit_kw: limitKw } : {}),
    ends_at: activation === "SetPowerLimit" ? now + holdMs : null,
  };
}

export function v1HpActivation(activation: V1HpActivation, now: number, holdMs: number): object {
  return { payload: { activation, timestamp: now, endsAt: activation === "Release" ? null : now + holdMs } };
}
