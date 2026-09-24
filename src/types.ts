import type {
  Acceptance,
  Configuration,
  ControlGranularity,
  EventKind,
  MarketRelationships,
  MeasurementType,
  ResourceState,
  ResourceType,
  Severity,
} from "./mqtt/messages";
import type { ApiVersion, Zone } from "./mqtt/topics";
import type { V1Declaration, V1EvActivation, V1HpActivation } from "./mqtt/v1";

export type { ResourceType, ResourceState };

/** The four DER resource states in lower case — the tone every badge, dot and bar resolves to. */
export type StatusTone = "available" | "activated" | "unavailable" | "faulted";

/** Console-side data freshness — not an API field. */
export type Freshness = "live" | "stale" | "lastKnown";

export interface MetricSample {
  value: number;
  resourceTimestamp: number | null;
  serverTimestamp: number;
  receivedAt: number;
}

export interface AckRecord {
  messageId: string;
  acceptance: Acceptance;
  reason: string | null;
  executedAt: number | null;
  /** executedAt − the activation's serverTimestamp. */
  latencyMs: number | null;
  receivedAt: number;
  /** The payload as received — v1 or v2 shape. */
  raw: object;
}

/** One command on v1 or v2 activation, joined to its acknowledgement (v2 by activationId, v1 by send time). */
export interface ActivationRecord {
  messageId: string;
  resourceId: string;
  zone: Zone;
  command: "Setpoint" | "Release";
  /** The v1 command name, for resources still on v1 (heat pump commands carry no magnitude). */
  v1Command: V1EvActivation | V1HpActivation | null;
  setpointKw: number | null;
  endsAt: number | null;
  serverTimestamp: number;
  receivedAt: number;
  /** First measuredPower after the command — what the resource achieved. */
  appliedKw: number | null;
  ack: AckRecord | null;
  raw: object;
}

export interface EventRecord {
  messageId: string;
  resourceId: string;
  zone: Zone;
  eventKind: EventKind;
  previousState: ResourceState | null;
  resourceState: ResourceState;
  severity: Severity;
  sessionState: string | null;
  code: string | null;
  description: string | null;
  resourceTimestamp: number | null;
  serverTimestamp: number;
  receivedAt: number;
  /** The broker published the resource's Last Will: ConnectionLost with a null resourceTimestamp. */
  lastWill: boolean;
  raw: object;
}

export interface Resource {
  id: string;
  zone: Zone;
  customer: string;
  /** Which topic prefix it publishes on. Migration is per resource; any v2 message makes it v2. */
  apiVersion: ApiVersion;
  /** v1 EV declarations removed in v2 (capability tier, daily schedule). */
  v1: V1Declaration | null;
  /** Null until a register message names it — a resource can speak before a late-joining console sees its registration. */
  type: ResourceType | null;
  subscriptionStatus: "Subscribed" | "Unsubscribed";
  maxImportKw: number | null;
  maxExportKw: number | null;
  controlGranularity: ControlGranularity | null;
  marketRelationships: MarketRelationships;
  configuration: Configuration;
  registeredAt: number | null;
  updatedAt: number | null;

  metrics: Partial<Record<MeasurementType, MetricSample>>;
  powerHistoryKw: number[];

  state: ResourceState | null;
  sessionState: string | null;
  /** Latest event, and the open fault (last Error event while the state is Faulted). */
  lastEvent: EventRecord | null;
  fault: EventRecord | null;

  command: ActivationRecord | null;

  lastMessageAt: number;
  lastSampleAt: number | null;
}

export type ConnectionStatus =
  | { kind: "connecting"; detail: string }
  | { kind: "live"; detail: string }
  /** Was live, lost the socket; mqtt.js is retrying. */
  | { kind: "reconnecting"; detail: string; since: number }
  /** Never reached the broker (unreachable or not configured). */
  | { kind: "disconnected"; detail: string };
