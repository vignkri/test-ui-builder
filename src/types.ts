import type {
  Acceptance,
  EvActivation,
  EvCapability,
  EvSchedule,
  EvStatus,
  HpActivation,
  HpStatus,
} from "./mqtt/messages";
import type { Channel, Zone } from "./mqtt/topics";

export type ResourceType = "ev-charger" | "heat-pump";

/** Coarse health bucket derived from live state; drives map/feed colours and the Faults view. */
export type Health = "ok" | "needs-attention" | "fault" | "offline";

export interface ActiveActivation {
  kind: EvActivation | HpActivation;
  powerLimitKw: number | null;
  endsAt: number | null;
  sentAt: number;
  eventId: string | null;
}

export interface Acknowledgement {
  acceptance: Acceptance;
  roundTripMs: number | null;
  at: number;
}

export interface Resource {
  id: string;
  type: ResourceType;
  zone: Zone;
  customer: string;

  subscriptionStatus: "Subscribed" | "Unsubscribed";
  capability: EvCapability[];
  currentType: "AC" | "DC" | null;
  schedule: EvSchedule | null;
  brpCode: string | null;
  compressorRatedPowerKW: number | null;
  backupHeaterRatedPowerKW: number | null;

  status: EvStatus | HpStatus | null;
  powerKw: number | null;
  powerHistoryKw: number[];
  availableUpKw: number | null;
  availableDownKw: number | null;

  activation: ActiveActivation | null;
  acknowledgement: Acknowledgement | null;
  /** EV only: an activation was delivered and no acknowledgement has followed it yet. */
  ackPending: boolean;

  registeredAt: number;
  lastMessageAt: number;
  /** Normalised 0..1 map coordinates. The spec carries no geo data, so this is a stable hash of the id. */
  mapPosition: { x: number; y: number };
}

export interface FeedEntry {
  id: string;
  resourceId: string;
  resourceType: ResourceType;
  channel: Channel;
  summary: string;
  at: number;
  health: Health;
}

export type ConnectionStatus =
  | { kind: "connecting"; detail: string }
  | { kind: "live"; detail: string }
  /** Was live, lost the socket; mqtt.js is retrying. */
  | { kind: "reconnecting"; detail: string }
  /** Never reached the broker (unreachable or not configured). */
  | { kind: "disconnected"; detail: string };
