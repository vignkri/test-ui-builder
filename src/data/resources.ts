import type {
  AckStatus,
  Resource,
  ResourceState,
  ResourceStatus,
  ResourceType,
  Zone,
} from "../types";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function formatAgo(seconds: number): string {
  if (seconds < 1) return "now";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.round(seconds / 60)}m`;
}

const EV_STATES: [ResourceState, number][] = [
  ["Charging", 0.55],
  ["Available", 0.32],
  ["Offline", 0.13],
];

const HP_STATES: [ResourceState, number][] = [
  ["ActivatedDown", 0.3],
  ["ActivatedUp", 0.25],
  ["Available", 0.38],
  ["Offline", 0.07],
];

function weighted<T>(table: [T, number][]): T {
  const r = rand();
  let acc = 0;
  for (const [value, weight] of table) {
    acc += weight;
    if (r <= acc) return value;
  }
  return table[table.length - 1][0];
}

function statusFor(state: ResourceState, ack: AckStatus): ResourceStatus {
  if (state === "Offline") return "offline";
  if (ack === "EvseOffline") return "fault";
  if (ack === "Pending") return "needs-attention";
  return "ok";
}

function makeActivity(id: string, type: ResourceType, powerKw: number): Resource["activity"] {
  const topics =
    type === "ev-charger"
      ? ["v1/power", "v1/activation", "v1/acknowledgement", "v1/register"]
      : ["v1/measurement", "v1/activation", "v1/event"];
  const count = 2 + Math.floor(rand() * 3);
  let cursorSeconds = rand() * 20;
  return Array.from({ length: count }, (_, i) => {
    const topic = pick(topics);
    let payload: string;
    switch (topic) {
      case "v1/power":
        payload = `${powerKw.toFixed(1)} kW`;
        break;
      case "v1/measurement":
        payload = `↑${(rand() * 6).toFixed(1)} / ↓${(rand() * 4).toFixed(1)} kW`;
        break;
      case "v1/acknowledgement":
        payload = `Accepted · ${40 + Math.floor(rand() * 40)} ms`;
        break;
      case "v1/register":
        payload = "capability Standard";
        break;
      case "v1/event":
        payload = rand() > 0.5 ? "ActivatedUp" : "ActivatedDown";
        break;
      default:
        payload = rand() > 0.5 ? "ActivationDown" : `SetPowerLimit ${(3 + rand() * 8).toFixed(1)} kW`;
    }
    cursorSeconds += 2 + rand() * 90;
    return {
      id: `${id}-evt-${i}`,
      topic,
      payload,
      at: `${formatAgo(cursorSeconds)} ago`,
      atSeconds: cursorSeconds,
    };
  });
}

function makeResource(index: number): Resource {
  const type: ResourceType = index % 4 === 3 ? "heat-pump" : "ev-charger";
  const zone: Zone = rand() > 0.5 ? "DK1" : "DK2";
  const state = weighted(type === "ev-charger" ? EV_STATES : HP_STATES);
  const maxPowerKw = type === "ev-charger" ? 11 : 9;
  const powerLimitKw = Math.round((3 + rand() * (maxPowerKw - 3)) * 10) / 10;

  let currentPowerKw = 0;
  let activation: string | null = null;
  let ack: AckStatus = null;
  let telemetry: string;

  if (type === "ev-charger") {
    if (state === "Charging") {
      currentPowerKw = Math.round(Math.min(powerLimitKw, 2 + rand() * 9) * 10) / 10;
      activation = rand() > 0.3 ? `SetPowerLimit ${powerLimitKw.toFixed(1)} kW` : "Bulk limit 5.0 kW";
      ack = rand() > 0.2 ? "Accepted" : "Pending";
    } else if (state === "Available") {
      activation = null;
      ack = null;
    } else {
      activation = null;
      ack = "EvseOffline";
    }
    telemetry = state === "Offline" ? "—" : `${currentPowerKw.toFixed(1)} kW`;
  } else {
    const up = Math.round(rand() * 6 * 10) / 10;
    const down = Math.round(rand() * 4 * 10) / 10;
    currentPowerKw = up;
    if (state === "ActivatedDown") activation = "ActivationDown";
    else if (state === "ActivatedUp") activation = "ActivationUp";
    else if (state === "Available") activation = "Release";
    ack = state === "Offline" ? "EvseOffline" : "n/a";
    telemetry = state === "Offline" ? "—" : `↑${up.toFixed(1)} / ↓${down.toFixed(1)} kW`;
  }

  const id =
    type === "ev-charger"
      ? `ev-cp-${(400 + index).toString().padStart(4, "0")}`
      : `hp-${pick(["villa", "row", "farm"])}-${(index % 60).toString().padStart(3, "0")}`;

  const powerHistoryKw = Array.from({ length: 20 }, (_, i) => {
    const wave = Math.sin(i / 3) * 0.3 + 0.7;
    return Math.round(Math.max(0, currentPowerKw * wave + rand() * 1.5) * 10) / 10;
  });

  return {
    id,
    type,
    status: statusFor(state, ack),
    zone,
    state,
    activation,
    telemetry,
    ack,
    lat: 55.6 + rand() * 0.6,
    lng: 12.4 + rand() * 0.8,
    powerLimitKw,
    maxPowerKw,
    currentPowerKw,
    powerHistoryKw,
    endsAt: `${12 + Math.floor(rand() * 8)}:00:00`,
    roundTripMs: 30 + Math.floor(rand() * 60),
    capability: type === "ev-charger" ? "Standard, Enhanced" : "Standard",
    currentType: type === "ev-charger" ? "AC" : "Thermal",
    subscriptionStatus: state === "Offline" ? "Unsubscribed" : "Subscribed",
    schedule: "06:00 – 22:00",
    activity: makeActivity(id, type, currentPowerKw),
  };
}

export const RESOURCES: Resource[] = Array.from({ length: 128 }, (_, i) => makeResource(i));

export const MAP_BOUNDS = { minLat: 55.6, maxLat: 56.2, minLng: 12.4, maxLng: 13.2 };

export interface FeedEntry {
  id: string;
  resourceId: string;
  resourceType: ResourceType;
  status: ResourceStatus;
  topic: string;
  payload: string;
  at: string;
  atSeconds: number;
}

export const EVENT_FEED: FeedEntry[] = RESOURCES.flatMap((r) =>
  r.activity.map((e) => ({
    id: e.id,
    resourceId: r.id,
    resourceType: r.type,
    status: r.status,
    topic: e.topic,
    payload: e.payload,
    at: e.at,
    atSeconds: e.atSeconds,
  }))
)
  .sort((a, b) => a.atSeconds - b.atSeconds)
  .slice(0, 40);

export const TYPE_LABEL: Record<ResourceType, string> = {
  "ev-charger": "EV Charger",
  "heat-pump": "Heat Pump",
};
