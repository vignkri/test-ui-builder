import type { ConnectionStatus, Resource } from "../types";
import type { MqttConnection } from "./connection";
import type { EvActivation, EvActivationMessage, HpActivation, HpActivationMessage } from "./messages";
import { FleetStore } from "./store";
import { buildTopic } from "./topics";
import { ulid } from "./ulid";

const ACTIVATION_DURATION_MS = 3_600_000;

const env = import.meta.env;
const CUSTOMER: string = env.VITE_MQTT_CUSTOMER || "acme-flex";
const MQTT_URL: string | undefined = env.VITE_MQTT_URL || undefined;

export const fleetStore = new FleetStore();

let connection: MqttConnection | null = null;
const statusListeners = new Set<() => void>();
let statusSnapshot: ConnectionStatus = MQTT_URL
  ? { kind: "connecting", detail: MQTT_URL }
  : { kind: "disconnected", detail: "VITE_MQTT_URL is not set" };

function setStatus(s: ConnectionStatus): void {
  statusSnapshot = s;
  for (const l of statusListeners) l();
}

async function start(url: string): Promise<void> {
  // mqtt.js is ~350 kB; keep it out of the initial bundle.
  const { MqttConnection } = await import("./connection");
  connection = new MqttConnection(fleetStore, {
    url,
    username: env.VITE_MQTT_USERNAME || undefined,
    password: env.VITE_MQTT_PASSWORD || undefined,
    customer: CUSTOMER,
    protocolVersion: env.VITE_MQTT_PROTOCOL_VERSION === "5" ? 5 : 4,
  });
  connection.onStatus(setStatus);
  connection.start();
}

if (MQTT_URL) void start(MQTT_URL);

export const connectionStatusStore = {
  subscribe(listener: () => void): () => void {
    statusListeners.add(listener);
    return () => statusListeners.delete(listener);
  },
  getSnapshot(): ConnectionStatus {
    return statusSnapshot;
  },
};

export function sendEvActivation(r: Resource, activation: EvActivation, powerLimitKw?: number): boolean {
  const now = Date.now();
  const msg: EvActivationMessage = {
    event_id: ulid(now),
    resource_id: r.id,
    activation,
    timestamp: now,
    ...(activation === "SetPowerLimit" ? { power_limit_kw: powerLimitKw } : {}),
    ends_at: activation === "SetPowerLimit" ? now + ACTIVATION_DURATION_MS : null,
  };
  return connection?.publish(buildTopic(r.zone, r.customer, "activation", r.id), msg) ?? false;
}

export function sendHpActivation(r: Resource, activation: HpActivation): boolean {
  const now = Date.now();
  const msg: HpActivationMessage = {
    payload: { activation, timestamp: now, endsAt: activation === "Release" ? null : now + ACTIVATION_DURATION_MS },
  };
  return connection?.publish(buildTopic(r.zone, r.customer, "activation", r.id), msg) ?? false;
}
