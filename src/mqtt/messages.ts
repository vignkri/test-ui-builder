/* Payload shapes per https://connect.gridhub.ai — EV chargers use snake_case,
   heat pumps use camelCase. Field names are kept verbatim from the spec. */

import type { Zone } from "./topics";

// ---------- EV chargers ----------

export const EV_CAPABILITIES = ["Basic", "Standard", "Enhanced", "Full", "DynamicBinning"] as const;
export type EvCapability = (typeof EV_CAPABILITIES)[number];

export const EV_STATUSES = [
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
export type EvStatus = (typeof EV_STATUSES)[number];

export const EV_ACTIVATIONS = ["SetPowerLimit", "ClearPowerLimit"] as const;
export type EvActivation = (typeof EV_ACTIVATIONS)[number];

export const ACCEPTANCE_CODES = [
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
export type Acceptance = (typeof ACCEPTANCE_CODES)[number];

export interface EvSchedule {
  starts_at: string;
  ends_at: string;
}

export interface EvRegisterMessage {
  timestamp: number;
  event_id: string;
  resource_id: string;
  capability: EvCapability[];
  current_type: "AC" | "DC";
  subscription_status: "Subscribed" | "Unsubscribed";
  schedule: EvSchedule | null;
  market_relationships?: {
    balance_responsible_party?: { code: string; encoding: "GS1" };
  };
}

export interface EvPowerMessage {
  event_id: string;
  resource_id: string;
  power_kw: number;
  timestamp_evse: number | null;
  timestamp_server: number;
}

export interface EvStatusMessage {
  event_id: string;
  resource_id: string;
  status: EvStatus;
  time_since_heartbeat: number | null;
  timestamp_evse: number | null;
  timestamp_server: number;
}

export interface EvActivationMessage {
  event_id: string;
  resource_id: string;
  activation: EvActivation;
  timestamp: number;
  power_limit_kw?: number;
  ends_at: number | null;
}

export interface EvAcknowledgementMessage {
  event_id: string;
  resource_id: string;
  timestamp: number;
  acceptance: Acceptance;
  sent_at: number;
  executed_at: number | null;
}

export interface EvUpdateMessage {
  event_id: string;
  resource_id: string;
  data: Partial<Pick<EvRegisterMessage, "capability" | "subscription_status" | "schedule">>;
}

// ---------- Heat pumps ----------

export const HP_STATUSES = ["Available", "ActivatedUp", "ActivatedDown", "Unavailable"] as const;
export type HpStatus = (typeof HP_STATUSES)[number];

export const HP_ACTIVATIONS = ["ActivationUp", "ActivationDown", "Release"] as const;
export type HpActivation = (typeof HP_ACTIVATIONS)[number];

export interface HpRegisterEntry {
  resourceId: string;
  subscriptionStatus: "Subscribed" | "Unsubscribed";
  priceZone: Zone;
  configuration: {
    compressorRatedPowerKW: number;
    backupHeaterRatedPowerKW: number;
  };
}

export interface HpRegisterMessage {
  eventId: string;
  timestamp: number;
  payload: HpRegisterEntry[];
}

export interface HpMeasurementMessage {
  resourceTimestamp: number | null;
  serverTimestamp: number;
  availableUpKw: number;
  availableDownKw: number;
}

export interface HpEventMessage {
  eventKind: "Status" | "Error";
  status: HpStatus;
  resourceTimestamp: number | null;
  serverTimestamp: number;
}

export interface HpActivationMessage {
  payload: {
    activation: HpActivation;
    timestamp: number;
    endsAt: number | null;
  };
}

export interface ZonalScheduleSlot {
  time_start: number;
  time_end: number;
  is_turn_off_heating: boolean;
}

// ---------- type guards ----------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function isEvRegister(v: unknown): v is EvRegisterMessage {
  return isObject(v) && typeof v.resource_id === "string" && Array.isArray(v.capability);
}

export function isHpRegister(v: unknown): v is HpRegisterMessage {
  return isObject(v) && Array.isArray(v.payload) && typeof v.eventId === "string";
}

export function isEvPower(v: unknown): v is EvPowerMessage {
  return isObject(v) && typeof v.resource_id === "string" && typeof v.power_kw === "number";
}

export function isEvStatus(v: unknown): v is EvStatusMessage {
  return (
    isObject(v) &&
    typeof v.resource_id === "string" &&
    (EV_STATUSES as readonly string[]).includes(String(v.status))
  );
}

export function isEvActivation(v: unknown): v is EvActivationMessage {
  return (
    isObject(v) &&
    typeof v.resource_id === "string" &&
    (EV_ACTIVATIONS as readonly string[]).includes(String(v.activation))
  );
}

export function isEvAcknowledgement(v: unknown): v is EvAcknowledgementMessage {
  return (
    isObject(v) &&
    typeof v.resource_id === "string" &&
    (ACCEPTANCE_CODES as readonly string[]).includes(String(v.acceptance))
  );
}

export function isEvUpdate(v: unknown): v is EvUpdateMessage {
  return isObject(v) && typeof v.resource_id === "string" && isObject(v.data);
}

export function isHpMeasurement(v: unknown): v is HpMeasurementMessage {
  return isObject(v) && typeof v.availableUpKw === "number" && typeof v.availableDownKw === "number";
}

export function isHpEvent(v: unknown): v is HpEventMessage {
  return isObject(v) && (HP_STATUSES as readonly string[]).includes(String(v.status));
}

export function isHpActivation(v: unknown): v is HpActivationMessage {
  return (
    isObject(v) &&
    isObject(v.payload) &&
    (HP_ACTIVATIONS as readonly string[]).includes(String(v.payload.activation))
  );
}
