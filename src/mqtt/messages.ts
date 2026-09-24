/**
 * Distributed Energy Resources API v2 — payload types with the spec's exact field names.
 * Payloads are flat camelCase JSON; there is no nested `payload` wrapper on any channel.
 * https://connect.gridhub.ai/distributed-resources/quickstart
 */
export const RESOURCE_TYPES = ["evCharger", "heatPump", "bess", "chp", "p2x", "pv", "misc"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESOURCE_STATES = ["Available", "Unavailable", "Activated", "Faulted"] as const;
export type ResourceState = (typeof RESOURCE_STATES)[number];

export const SEVERITIES = ["INFO", "LOW", "HIGH", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const EVENT_KINDS = ["Status", "Error"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** OCPP session states — EV chargers only, beside resourceState rather than inside it. */
export const SESSION_STATES = ["Preparing", "Charging", "SuspendedEV", "SuspendedEVSE", "Reserved"] as const;

export const ACCEPTANCES = [
  "Accepted",
  "Rejected",
  "Offline",
  "NotAvailable",
  "InvalidResourceId",
  "InvalidMessageFormat",
  "InternalError",
  "Unauthorised",
] as const;
export type Acceptance = (typeof ACCEPTANCES)[number];

export const MEASUREMENT_TYPES = [
  "measuredPower",
  "availablePowerUp",
  "availablePowerDown",
  "stateOfCharge",
  "availableEnergyUp",
  "availableEnergyDown",
] as const;
export type MeasurementType = (typeof MEASUREMENT_TYPES)[number];

export type ControlGranularity =
  | { mode: "Steps"; stepsKw: number[] }
  | { mode: "Continuous"; minKw: number; maxKw: number };

export interface MarketParty {
  code: string;
  encoding: "GS1";
}

export interface MarketRelationships {
  balanceResponsibleParty?: MarketParty;
  retailer?: MarketParty;
}

export interface ModuleGroup {
  capacityKwp: number;
  azimuth: number;
  inclination: number;
}

/** Type-specific equipment properties. chp, p2x and misc declare none: `{}`. */
export interface Configuration {
  currentType?: "AC" | "DC";
  compressorRatedPowerKw?: number;
  backupHeaterRatedPowerKw?: number;
  powerRatedKw?: number;
  powerUsableKw?: number;
  storageRatedKwh?: number;
  storageUsableKwh?: number;
  minSoc?: number;
  maxSoc?: number;
  chargeEfficiency?: number;
  dischargeEfficiency?: number;
  latitude?: number;
  longitude?: number;
  systemLoss?: number;
  moduleGroups?: ModuleGroup[];
}

export interface RegisterEntry {
  resourceId: string;
  resourceType: ResourceType;
  subscriptionStatus: "Subscribed" | "Unsubscribed";
  maxImportKw: number;
  maxExportKw: number;
  controlGranularity: ControlGranularity;
  marketRelationships?: MarketRelationships;
  configuration: Configuration;
}

export interface RegisterMessage {
  messageId: string;
  timestamp: number;
  resources: RegisterEntry[];
}

/** Only the fields that change. `configuration` is replaced whole; `resourceType` never updates. */
export interface UpdateMessage extends Partial<Omit<RegisterEntry, "resourceId" | "resourceType">> {
  messageId: string;
  timestamp: number;
  resourceId: string;
}

export interface MeasurementMessage {
  messageId: string;
  resourceId: string;
  measurementType: MeasurementType;
  value: number;
  unit: "kW" | "kWh" | "%";
  resourceTimestamp: number | null;
  serverTimestamp: number;
}

export interface EventMessage {
  messageId: string;
  resourceId: string;
  eventKind: EventKind;
  resourceState: ResourceState;
  severity: Severity;
  sessionState?: string;
  code?: string;
  description?: string;
  resourceTimestamp: number | null;
  serverTimestamp: number;
}

export type ActivationMessage =
  | {
      messageId: string;
      resourceId: string;
      activation: "Setpoint";
      setpoint: number;
      unit: "kW";
      endsAt: number;
      serverTimestamp: number;
    }
  | {
      messageId: string;
      resourceId: string;
      activation: "Release";
      serverTimestamp: number;
    };

export interface AcknowledgementMessage {
  messageId: string;
  resourceId: string;
  activationId: string;
  acceptance: Acceptance;
  reason?: string;
  executedAt: number | null;
}

// ---------- runtime guards ----------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function oneOf<T extends string>(values: readonly T[], v: unknown): v is T {
  return typeof v === "string" && (values as readonly string[]).includes(v);
}

export function isRegisterEntry(v: unknown): v is RegisterEntry {
  return (
    isObject(v) &&
    typeof v.resourceId === "string" &&
    oneOf(RESOURCE_TYPES, v.resourceType) &&
    typeof v.maxImportKw === "number" &&
    typeof v.maxExportKw === "number" &&
    isObject(v.controlGranularity)
  );
}

export function isRegister(v: unknown): v is RegisterMessage {
  return isObject(v) && Array.isArray(v.resources);
}

export function isUpdate(v: unknown): v is UpdateMessage {
  return isObject(v) && typeof v.resourceId === "string" && !("measurementType" in v) && !("eventKind" in v);
}

export function isMeasurement(v: unknown): v is MeasurementMessage {
  return (
    isObject(v) && typeof v.resourceId === "string" && oneOf(MEASUREMENT_TYPES, v.measurementType) && typeof v.value === "number"
  );
}

export function isEvent(v: unknown): v is EventMessage {
  return isObject(v) && typeof v.resourceId === "string" && oneOf(EVENT_KINDS, v.eventKind) && oneOf(RESOURCE_STATES, v.resourceState);
}

export function isActivation(v: unknown): v is ActivationMessage {
  if (!isObject(v) || typeof v.resourceId !== "string" || typeof v.messageId !== "string") return false;
  if (v.activation === "Release") return true;
  return v.activation === "Setpoint" && typeof v.setpoint === "number";
}

export function isAcknowledgement(v: unknown): v is AcknowledgementMessage {
  return isObject(v) && typeof v.resourceId === "string" && typeof v.activationId === "string" && oneOf(ACCEPTANCES, v.acceptance);
}
