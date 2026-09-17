import type { Resource, ResourceStatus, ResourceType } from "../types";

const SITES = ["North Depot", "Riverside", "Harbor Yard", "Uplands", "Central Hub"];

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

const STATUS_WEIGHTS: [ResourceStatus, number][] = [
  ["ok", 0.72],
  ["needs-attention", 0.16],
  ["fault", 0.07],
  ["offline", 0.05],
];

function weightedStatus(): ResourceStatus {
  const r = rand();
  let acc = 0;
  for (const [status, weight] of STATUS_WEIGHTS) {
    acc += weight;
    if (r <= acc) return status;
  }
  return "ok";
}

function formatAgo(seconds: number): string {
  if (seconds < 1) return "now";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.round(seconds / 60)}m`;
}

function makeActivity(id: string, type: ResourceType): Resource["activity"] {
  const topics =
    type === "ev-charger"
      ? ["v1/power", "v1/activation", "v1/acknowledgement", "v1/register"]
      : ["v1/measurement", "v1/activation", "v1/event"];
  const count = 2 + Math.floor(rand() * 3);
  let cursorSeconds = rand() * 20;
  return Array.from({ length: count }, (_, i) => {
    const topic = pick(topics);
    const payload =
      type === "ev-charger"
        ? `SetPowerLimit ${(4 + rand() * 7).toFixed(1)} kW`
        : `SetTargetTemp ${(18 + rand() * 4).toFixed(1)} °C`;
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
  const type: ResourceType = index % 2 === 0 ? "ev-charger" : "heat-pump";
  const status = weightedStatus();
  const maxPowerKw = type === "ev-charger" ? 11 : 9;
  const powerLimitKw = Math.round((2 + rand() * (maxPowerKw - 2)) * 10) / 10;
  const currentPowerKw =
    status === "offline" ? 0 : Math.round(rand() * powerLimitKw * 10) / 10;
  const id =
    type === "ev-charger"
      ? `ev-cp-${(400 + index).toString().padStart(4, "0")}`
      : `hp-${(100 + index).toString().padStart(4, "0")}`;

  return {
    id,
    name: type === "ev-charger" ? `Charge point ${index + 1}` : `Heat pump ${index + 1}`,
    type,
    status,
    site: pick(SITES),
    lat: 55.6 + rand() * 0.6,
    lng: 12.4 + rand() * 0.8,
    powerLimitKw,
    maxPowerKw,
    currentPowerKw,
    lastSeen: status === "offline" ? `${2 + Math.floor(rand() * 10)}h ago` : "just now",
    activity: makeActivity(id, type),
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

export const STATUS_LABEL: Record<ResourceStatus, string> = {
  ok: "OK",
  "needs-attention": "Needs attention",
  fault: "Fault",
  offline: "Offline",
};

export const TYPE_LABEL: Record<ResourceType, string> = {
  "ev-charger": "EV charger",
  "heat-pump": "Heat pump",
};
