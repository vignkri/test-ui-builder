import type { ConnectionStatus, Resource } from "../types";
import type { MqttConnection } from "./connection";
import type { ActivationMessage } from "./messages";
import { FleetStore } from "./store";
import { buildTopic } from "./topics";
import { ulid } from "./ulid";
import { v1EvActivation, v1HpActivation, type V1EvActivation, type V1HpActivation } from "./v1";

/** How long a setpoint holds before the resource may revert on its own. The spec requires endsAt. */
export const SETPOINT_HOLD_MS = 3_600_000;

const env = import.meta.env;
export const CUSTOMER: string = env.VITE_MQTT_CUSTOMER || "acme-flex";
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

export function retryConnection(): void {
  connection?.reconnect();
}

/** Commands go out on the version the resource speaks — a v1 resource never sees a v2 payload. */
function publish(r: Resource, msg: object): boolean {
  return connection?.publish(buildTopic(r.apiVersion, r.zone, r.customer, "activation", r.id), msg) ?? false;
}

/** v2 Setpoint: an absolute, signed target on the generator convention, held until endsAt or a release. */
export function sendSetpoint(r: Resource, setpointKw: number, holdMs: number = SETPOINT_HOLD_MS): boolean {
  if (r.apiVersion !== "v2") return false;
  const now = Date.now();
  const msg: ActivationMessage = {
    messageId: ulid(now),
    resourceId: r.id,
    activation: "Setpoint",
    setpoint: setpointKw,
    unit: "kW",
    endsAt: now + holdMs,
    serverTimestamp: now,
  };
  return publish(r, msg);
}

/** Release returns the resource to its own control logic. It is not a setpoint of 0. */
export function sendRelease(r: Resource): boolean {
  if (r.apiVersion !== "v2") return false;
  const now = Date.now();
  const msg: ActivationMessage = { messageId: ulid(now), resourceId: r.id, activation: "Release", serverTimestamp: now };
  return publish(r, msg);
}

/** v1 EV charger: SetPowerLimit caps consumption at a positive kW; ClearPowerLimit lifts it. */
export function sendV1EvActivation(r: Resource, activation: V1EvActivation, limitKw?: number): boolean {
  if (r.apiVersion !== "v1") return false;
  const now = Date.now();
  return publish(r, v1EvActivation(r.id, activation, ulid(now), now, SETPOINT_HOLD_MS, limitKw));
}

/** v1 heat pump: directional, no magnitude. Up sheds consumption, Down engages the backup heater. */
export function sendV1HpActivation(r: Resource, activation: V1HpActivation): boolean {
  if (r.apiVersion !== "v1") return false;
  return publish(r, v1HpActivation(activation, Date.now(), SETPOINT_HOLD_MS));
}

/** The payload a Release would carry, for the confirmation dialog preview. */
export function releasePreview(r: Resource, at: number): object {
  return { resourceId: r.id, activation: "Release", serverTimestamp: at };
}
