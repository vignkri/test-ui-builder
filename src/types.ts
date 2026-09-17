export type ResourceType = "ev-charger" | "heat-pump";

export type ResourceStatus = "ok" | "needs-attention" | "fault" | "offline";

export interface ActivityEvent {
  id: string;
  topic: string;
  payload: string;
  at: string;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  status: ResourceStatus;
  site: string;
  lat: number;
  lng: number;
  powerLimitKw: number;
  maxPowerKw: number;
  currentPowerKw: number;
  lastSeen: string;
  activity: ActivityEvent[];
}
