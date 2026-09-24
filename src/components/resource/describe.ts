import type { EventRecord, Resource } from "../../types";
import { activeSetpoint, appliedKw, commandLabel, formatClock, formatKw, formatSigned, metric } from "../../mqtt/derive";

/** The quiet second line under a state badge: session, SoC, curtailment, Last Will, fault code. */
export function stateDetail(r: Resource): string | null {
  if (r.state === null) return "No event yet";
  if (r.state === "Faulted") return r.fault?.code ?? null;
  if (r.state === "Unavailable") return r.lastEvent?.lastWill ? "Last Will" : (r.lastEvent?.code ?? null);
  if (r.type === "evCharger" && r.sessionState) return `Session · ${r.sessionState}`;
  if (r.type === "bess") {
    const soc = metric(r, "stateOfCharge");
    if (soc !== null) return `SoC ${Math.round(soc)} %`;
  }
  if (r.type === "pv" && r.state === "Activated") return "Curtailed";
  return null;
}

export interface CommandSummary {
  primary: string;
  secondary: string | null;
  tone: "default" | "faulted";
}

/** The Command column: a fault or dropped link first, then the active setpoint, else own control. */
export function commandSummary(r: Resource, now: number): CommandSummary {
  if (r.state === "Faulted" && r.fault) {
    return {
      primary: `Error · ${r.fault.code ?? "fault"}`,
      secondary: r.fault.description,
      tone: "faulted",
    };
  }
  if (r.state === "Unavailable" && r.lastEvent?.lastWill) {
    return { primary: "ConnectionLost", secondary: `LWT received ${formatClock(r.lastEvent.receivedAt)}`, tone: "default" };
  }
  const c = activeSetpoint(r.command, now);
  if (c) {
    const achieved = appliedKw(c);
    const target = c.v1Command ? commandLabel(c) : `Setpoint ${formatSigned(c.setpointKw ?? 0)}`;
    const applied =
      c.v1Command ? "" : achieved !== null && Math.abs(achieved - (c.setpointKw ?? 0)) >= 0.05 ? ` → ${formatKw(achieved)}` : " kW";
    const parts = [
      r.type === "pv" ? "Curtailing" : null,
      c.endsAt !== null ? `until ${formatClock(c.endsAt)}` : null,
      // v1 heat pumps never acknowledge.
      r.apiVersion === "v1" && r.type === "heatPump" ? null : (c.ack?.acceptance ?? "awaiting ack"),
    ].filter(Boolean);
    return { primary: target + applied, secondary: parts.join(" · "), tone: "default" };
  }
  if (r.command?.command === "Release") return { primary: "Own control", secondary: `Released ${formatClock(r.command.serverTimestamp)}`, tone: "default" };
  return { primary: "Own control", secondary: "—", tone: "default" };
}

/** The telemetry topic a resource publishes on — v1 EV power, v1 heat pump measurement, or v2. */
export function measurementsTopic(r: Resource): string {
  const channel = r.apiVersion === "v2" ? "measurements" : r.type === "heatPump" ? "measurement" : "power";
  return `${r.zone}/${r.customer}/${r.apiVersion}/${channel}/${r.id}`;
}

/** One line for a timeline row: Last Will, fault code, partner text, session state, severity. */
export function eventLine(e: EventRecord): string {
  if (e.lastWill) return `ConnectionLost · Last Will · ${e.severity}`;
  const parts = [
    e.eventKind === "Error" ? `Error ${e.code ?? ""}`.trim() : null,
    e.eventKind !== "Error" && e.code ? e.code : null,
    e.description,
    e.sessionState ? `sessionState ${e.sessionState}` : null,
  ].filter(Boolean);
  return parts.length ? `${parts.join(" · ")} · ${e.severity}` : `${e.eventKind} · ${e.severity}`;
}

/** Azimuth is degrees from true south, positive toward east. */
export function compass(azimuth: number): string {
  const a = ((azimuth % 360) + 540) % 360 - 180;
  if (Math.abs(a) <= 22.5) return "S";
  if (Math.abs(a) >= 157.5) return "N";
  const side = a > 0 ? "E" : "W";
  if (Math.abs(a) < 67.5) return `S${side}`;
  if (Math.abs(a) <= 112.5) return side;
  return `N${side}`;
}
