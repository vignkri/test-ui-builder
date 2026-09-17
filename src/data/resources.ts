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

function makeActivity(id: string, type: ResourceType): Resource["activity"] {
  const topics =
    type === "ev-charger"
      ? ["DK1/acme-flex/v1/activation", "DK1/acme-flex/v1/session/stop", "DK1/acme-flex/v1/meter"]
      : ["DK1/heat-flex/v1/setpoint", "DK1/heat-flex/v1/defrost", "DK1/heat-flex/v1/meter"];
  const count = 2 + Math.floor(rand() * 3);
  return Array.from({ length: count }, (_, i) => {
    const topic = pick(topics);
    const payload =
      type === "ev-charger"
        ? `SetPowerLimit ${(4 + rand() * 7).toFixed(1)} kW`
        : `SetTargetTemp ${(18 + rand() * 4).toFixed(1)} °C`;
    const minutesAgo = (i + 1) * (3 + Math.floor(rand() * 20));
    return {
      id: `${id}-evt-${i}`,
      topic,
      payload,
      at: `${minutesAgo}m ago`,
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
