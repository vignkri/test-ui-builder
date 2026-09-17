import type { Health, Resource, ResourceType } from "../types";

export const TYPE_LABEL: Record<ResourceType, string> = {
  "ev-charger": "EV Charger",
  "heat-pump": "Heat Pump",
};

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

export function displayState(r: Resource): string {
  return r.status ?? "—";
}

export function displayActivation(r: Resource): string {
  const a = r.activation;
  if (!a) return "—";
  if (a.kind === "SetPowerLimit") return `SetPowerLimit ${(a.powerLimitKw ?? 0).toFixed(1)} kW`;
  return a.kind;
}

export function displayTelemetry(r: Resource): string {
  if (r.type === "heat-pump") {
    if (r.availableUpKw === null || r.availableDownKw === null) return "—";
    return `↑${r.availableUpKw.toFixed(1)} / ↓${r.availableDownKw.toFixed(1)} kW`;
  }
  return r.powerKw === null ? "—" : `${r.powerKw.toFixed(1)} kW`;
}

/** "Pending" is client-derived (activation seen, no ack yet); heat pumps never acknowledge. */
export function displayAck(r: Resource): string {
  if (r.type === "heat-pump") return "n/a";
  if (r.ackPending) return "Pending";
  return r.acknowledgement?.acceptance ?? "—";
}

export function ackTone(r: Resource): "green" | "amber" | "red" | "muted" {
  if (r.type === "heat-pump" || (!r.ackPending && !r.acknowledgement)) return "muted";
  if (r.ackPending) return "amber";
  return r.acknowledgement?.acceptance === "Accepted" ? "green" : "red";
}

export function stateTone(r: Resource): "green" | "blue" | "amber" | "red" | "low" {
  switch (r.status) {
    case "Charging":
      return "green";
    case "ActivatedUp":
    case "ActivatedDown":
      return "blue";
    case "SuspendedEV":
    case "SuspendedEVSE":
    case "Preparing":
    case "Reserved":
      return "amber";
    case "Faulted":
    case "Offline":
    case "Unavailable":
      return "red";
    default:
      return "low";
  }
}

export function formatAgo(atMs: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - atMs) / 1000));
  if (s < 1) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

export function formatClock(atMs: number): string {
  return new Date(atMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatUntil(atMs: number, now: number = Date.now()): string {
  const m = Math.round((atMs - now) / 60000);
  if (m <= 0) return "expired";
  return m < 60 ? `in ${m} min` : `in ${Math.round(m / 60)} h`;
}
