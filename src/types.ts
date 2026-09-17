export type ResourceType = "ev-charger" | "heat-pump";

export type ResourceStatus = "ok" | "needs-attention" | "fault" | "offline";

export type Zone = "DK1" | "DK2";

export type ResourceState =
  | "Charging"
  | "Available"
  | "ActivatedUp"
  | "ActivatedDown"
  | "Offline";

export type AckStatus = "Accepted" | "Pending" | "EvseOffline" | "n/a" | null;

export interface ActivityEvent {
  id: string;
  topic: string;
  payload: string;
  at: string;
  atSeconds: number;
}

export interface Resource {
  id: string;
  type: ResourceType;
  status: ResourceStatus;
  zone: Zone;
  state: ResourceState;
  activation: string | null;
  telemetry: string;
  ack: AckStatus;
  lat: number;
  lng: number;
  powerLimitKw: number;
  maxPowerKw: number;
  currentPowerKw: number;
  powerHistoryKw: number[];
  endsAt: string;
  roundTripMs: number;
  capability: string;
  currentType: string;
  subscriptionStatus: string;
  schedule: string;
  activity: ActivityEvent[];
}
