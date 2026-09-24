import type {
  Acceptance,
  ActivationMessage,
  AcknowledgementMessage,
  Configuration,
  ControlGranularity,
  EventKind,
  EventMessage,
  MarketRelationships,
  MeasurementType,
  ResourceState,
  ResourceType,
  Severity,
} from "./mqtt/messages";
import type { Zone } from "./mqtt/topics";

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
  raw: AcknowledgementMessage;
}

/** One command on v2/activation, joined to its acknowledgement by activationId. */
export interface ActivationRecord {
  messageId: string;
  resourceId: string;
  zone: Zone;
  command: "Setpoint" | "Release";
  setpointKw: number | null;
  endsAt: number | null;
  serverTimestamp: number;
  receivedAt: number;
  /** First measuredPower after the command — what the resource achieved. */
  appliedKw: number | null;
  ack: AckRecord | null;
  raw: ActivationMessage;
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
  raw: EventMessage;
}

export interface Resource {
  id: string;
  zone: Zone;
  customer: string;
  /** Null until v2/register names it — a resource can speak before a late-joining console sees its registration. */
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

/** A resource still publishing on v1 topics. */
export interface LegacyResource {
  resourceId: string;
  zone: Zone;
  channel: string;
  lastSeenAt: number;
}

export type ConnectionStatus =
  | { kind: "connecting"; detail: string }
  | { kind: "live"; detail: string }
  /** Was live, lost the socket; mqtt.js is retrying. */
  | { kind: "reconnecting"; detail: string; since: number }
  /** Never reached the broker (unreachable or not configured). */
  | { kind: "disconnected"; detail: string };
