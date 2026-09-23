import type { DerType, FeedEntry, Freshness, Health, Resource, ResourceType, StatusTone } from "../types";

export const ACK_TARGET_MS = 2000;

export function maxPowerKw(r: Resource): number {
  if (r.type === "heat-pump") {
    return (r.compressorRatedPowerKW ?? 0) + (r.backupHeaterRatedPowerKW ?? 0) || 9;
  }
  return r.currentType === "DC" ? 50 : 11;
}

export function healthOf(r: Resource, now: number = Date.now()): Health {
  if (r.status === "Offline") return "offline";
  if (r.status === "Faulted" || r.status === "Unavailable") return "fault";
  if (r.acknowledgement && r.acknowledgement.acceptance !== "Accepted" && !r.ackPending) {
    return "fault";
  }
  if (r.ackPending && now - (r.activation?.sentAt ?? now) > ACK_TARGET_MS) return "needs-attention";
  if (r.status === "SuspendedEV" || r.status === "SuspendedEVSE") return "needs-attention";
  return "ok";
}

export function displayActivation(r: Resource): string {
  const a = r.activation;
  if (!a) return "—";
  if (a.kind === "SetPowerLimit") return `Limit ${(a.powerLimitKw ?? 0).toFixed(1)} kW`;
  return a.kind;
}

/** Generator convention: export positive, import negative. A charging EV imports. */
export function signedPowerKw(r: Resource): number | null {
  return r.powerKw === null ? null : -r.powerKw;
}

export function formatSigned(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "\u2212" : "";
  return `${sign}${Math.abs(n).toFixed(1)}`;
}

export function formatKw(kw: number): string {
  return `${formatSigned(kw)} kW`;
}

/** Headroom is published as unsigned magnitudes; show it as sampled, never recomputed. */
export function formatHeadroom(r: Resource): string {
  if (r.availableUpKw === null || r.availableDownKw === null) return "—";
  return `\u2191 ${r.availableUpKw.toFixed(1)}  \u2193 ${r.availableDownKw.toFixed(1)}`;
}

/** "Pending" is client-derived (activation seen, no ack yet); heat pumps never acknowledge. */
export function displayAck(r: Resource): string {
  if (r.type === "heat-pump") return "n/a";
  if (r.ackPending) return "Pending";
  return r.acknowledgement?.acceptance ?? "—";
}

/**
 * Acknowledgement tone: Accepted is green, "the resource could not act" outcomes are grey,
 * rejections and malformed requests take the faulted tone, pending is platform-blue.
 * Null means there is nothing to acknowledge.
 */
export function ackTone(r: Resource): StatusTone | null {
  if (r.type === "heat-pump") return null;
  if (r.ackPending) return "activated";
  const acceptance = r.acknowledgement?.acceptance;
  if (!acceptance) return null;
  if (acceptance === "Accepted") return "available";
  if (acceptance === "EvseOffline" || acceptance === "EvDisconnected" || acceptance === "NoEvCharging") {
    return "unavailable";
  }
  return "faulted";
}

/**
 * Resource state → the four DER states. Activated means the platform holds it to a command;
 * the charger's own session states (Preparing, Suspended…) stay Available. Null = no event yet.
 */
export function stateTone(r: Resource): StatusTone | null {
  switch (r.status) {
    case null:
      return null;
    case "Faulted":
      return "faulted";
    case "Offline":
    case "Unavailable":
      return "unavailable";
    case "ActivatedUp":
    case "ActivatedDown":
      return "activated";
    default:
      return r.activation && r.activation.kind !== "ClearPowerLimit" && r.activation.kind !== "Release"
        ? "activated"
        : "available";
  }
}

/** Feed rows: dispatch traffic is platform-blue, everything else follows the resource's health. */
export function feedTone(e: FeedEntry): StatusTone {
  if (e.channel === "activation" || e.channel === "acknowledgement") {
    if (e.health === "ok") return "activated";
  }
  switch (e.health) {
    case "ok":
      return "available";
    case "offline":
      return "unavailable";
    default:
      return "faulted";
  }
}

/** No heartbeat exists, so a quiet resource is flagged "stale" — never shown as Unavailable. */
export const STALE_AFTER_MS = 5 * 60_000;

export function freshnessOf(r: Resource, live: boolean, now: number = Date.now()): Freshness {
  if (!live) return "lastKnown";
  return now - r.lastMessageAt > STALE_AFTER_MS ? "stale" : "live";
}

export const DER_TYPE: Record<ResourceType, DerType> = {
  "ev-charger": "evCharger",
  "heat-pump": "heatPump",
};

export function formatAgo(atMs: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - atMs) / 1000));
  if (s < 1) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

export function formatClock(atMs: number, withSeconds = true): string {
  return new Date(atMs).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  });
}

export function formatUntil(atMs: number, now: number = Date.now()): string {
  const m = Math.round((atMs - now) / 60000);
  if (m <= 0) return "expired";
  return m < 60 ? `in ${m} min` : `in ${Math.round(m / 60)} h`;
}
