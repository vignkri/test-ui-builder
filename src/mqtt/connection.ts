import mqtt, { type MqttClient } from "mqtt";
import type { ConnectionStatus } from "../types";
import type { FleetStore } from "./store";
import { ZONES, wildcardTopics } from "./topics";

export interface MqttConfig {
  /** Browsers can only speak MQTT over WebSocket, e.g. wss://aggregator.gridhub.dev:8884/mqtt */
  url: string;
  username?: string;
  password?: string;
  customer: string;
  clientId?: string;
  /** 4 = MQTT 3.1.1 (accepted by every broker), 5 = MQTT 5. The spec does not pin one. */
  protocolVersion?: 4 | 5;
}

/**
 * Subscribes to `{zone}/{customer}/v2/#` (and v1, noted for migration) for every price zone and feeds each message
 * to the store. Publishing goes to the broker, whose echo on our own subscription is
 * what updates the store — the UI never writes state it did not receive.
 */
export class MqttConnection {
  status: ConnectionStatus;
  private client: MqttClient | null = null;
  private listeners = new Set<(s: ConnectionStatus) => void>();
  private everConnected = false;
  private readonly store: FleetStore;
  private readonly config: MqttConfig;

  constructor(store: FleetStore, config: MqttConfig) {
    this.store = store;
    this.config = config;
    this.status = { kind: "connecting", detail: hostOf(config.url) };
  }

  start(): void {
    if (this.client) return;
    const host = hostOf(this.config.url);
    const client = mqtt.connect(this.config.url, {
      username: this.config.username,
      password: this.config.password,
      clientId: this.config.clientId ?? `der-console-${Math.random().toString(36).slice(2, 10)}`,
      clean: true,
      reconnectPeriod: 2000,
      connectTimeout: 8000,
      protocolVersion: this.config.protocolVersion ?? 4,
    });
    this.client = client;

    client.on("connect", () => {
      this.everConnected = true;
      const topics = ZONES.flatMap((z) => wildcardTopics(z, this.config.customer));
      client.subscribe(topics, { qos: 1 }, (err) => {
        this.setStatus(
          err ? { kind: "disconnected", detail: `subscribe failed: ${err.message}` } : { kind: "live", detail: host }
        );
      });
    });
    client.on("message", (topic, payload) => this.store.apply(topic, payload));
    client.on("close", () => {
      if (this.everConnected) {
        const since = this.status.kind === "reconnecting" ? this.status.since : Date.now();
        this.setStatus({ kind: "reconnecting", detail: host, since });
      } else {
        this.setStatus({ kind: "disconnected", detail: `no connection to ${host}` });
      }
    });
    client.on("error", (err) => {
      if (!this.everConnected) this.setStatus({ kind: "disconnected", detail: err.message });
    });
  }

  /** "Retry now": skip the remaining back-off and reconnect immediately. */
  reconnect(): void {
    this.client?.reconnect();
  }

  stop(): void {
    this.listeners.clear();
    this.client?.removeAllListeners();
    this.client?.end(true);
    this.client = null;
  }

  /** No-op unless live: an activation the broker never saw must not look sent. */
  publish(topic: string, payload: object): boolean {
    if (this.status.kind !== "live" || !this.client) return false;
    this.client.publish(topic, JSON.stringify(payload), { qos: 1 });
    return true;
  }

  onStatus(listener: (status: ConnectionStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: ConnectionStatus): void {
    if (status.kind === this.status.kind && status.detail === this.status.detail) return;
    this.status = status;
    for (const l of this.listeners) l(status);
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
