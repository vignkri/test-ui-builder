import type { ActivationRecord, Freshness, Resource, ResourceState, ResourceType, StatusTone } from "../types";
import type { Acceptance, ControlGranularity, MeasurementType } from "./messages";
import type { Zone } from "./topics";

export const TYPE_LABEL: Record<ResourceType, string> = {
  evCharger: "EV charger",
  heatPump: "Heat pump",
  bess: "Battery",
  chp: "CHP",
  p2x: "P2X",
  pv: "PV",
  misc: "Other",
};

export const TYPE_ORDER: ResourceType[] = ["evCharger", "heatPump", "bess", "chp", "p2x", "pv", "misc"];

/** Every type publishes the three power metrics; batteries add three state metrics. */
export function expectedMetrics(type: ResourceType | null): MeasurementType[] {
  const power: MeasurementType[] = ["measuredPower", "availablePowerUp", "availablePowerDown"];
  return type === "bess" ? [...power, "stateOfCharge", "availableEnergyUp", "availableEnergyDown"] : power;
}

export const METRIC_UNIT: Record<MeasurementType, string> = {
  measuredPower: "kW",
  availablePowerUp: "kW",
  availablePowerDown: "kW",
  stateOfCharge: "%",
  availableEnergyUp: "kWh",
  availableEnergyDown: "kWh",
};

export function metric(r: Resource, type: MeasurementType): number | null {
  return r.metrics[type]?.value ?? null;
}

// ---------- markets ----------

export interface MarketBound {
  market: string;
  dataFrequencyMs: number;
  roundtripMs: number;
  deliveryLagMs: number;
}

/** Market requirements (maximums) — https://connect.gridhub.ai/data-standards/markets */
export const MARKETS: Record<string, MarketBound> = {
  ffr: { market: "ffr", dataFrequencyMs: 100, roundtripMs: 1200, deliveryLagMs: 250 },
  "fcr-d": { market: "fcr-d", dataFrequencyMs: 1000, roundtripMs: 2000, deliveryLagMs: 250 },
  "fcr-n": { market: "fcr-n", dataFrequencyMs: 1000, roundtripMs: 2000, deliveryLagMs: 250 },
  fcr: { market: "fcr", dataFrequencyMs: 1000, roundtripMs: 2000, deliveryLagMs: 250 },
  afrr: { market: "afrr", dataFrequencyMs: 1000, roundtripMs: 2000, deliveryLagMs: 250 },
  mfrr: { market: "mfrr", dataFrequencyMs: 60_000, roundtripMs: 120_000, deliveryLagMs: 5000 },
  wholesale: { market: "wholesale", dataFrequencyMs: 60_000, roundtripMs: 120_000, deliveryLagMs: 5000 },
};

export const ZONE_MARKETS: Record<Zone, { area: string; markets: string[] }> = {
  DK1: { area: "Continental Europe", markets: ["fcr", "afrr", "mfrr", "wholesale"] },
  DK2: { area: "Nordic", markets: ["ffr", "fcr-d", "fcr-n", "afrr", "mfrr", "wholesale"] },
};

/**
 * Market enrolment is platform-owned and not on the wire, so the console judges every
 * acknowledgement against the 2 s bound shared by fcr, fcr-d, fcr-n and afrr.
 */
export const ACK_BOUND_MS = 2000;

/**
 * No heartbeat exists. Silence longer than the slowest market data frequency (mfrr and
 * wholesale, 1 min) is flagged "stale" — a data gap, never a resource state.
 */
export const STALE_AFTER_MS = 60_000;

export function freshnessOf(r: Resource, live: boolean, now: number = Date.now()): Freshness {
  if (!live) return "lastKnown";
  if (r.lastSampleAt === null || now - r.lastSampleAt > STALE_AFTER_MS) return "stale";
  return "live";
}

/** The expected metric that has gone quiet longest, for the Overview's attention list. */
export function oldestGap(r: Resource, now: number): { metric: MeasurementType; ageMs: number } | null {
  let worst: { metric: MeasurementType; ageMs: number } | null = null;
  for (const m of expectedMetrics(r.type)) {
    const s = r.metrics[m];
    const age = s ? now - s.receivedAt : Infinity;
    if (age > STALE_AFTER_MS && (!worst || age > worst.ageMs)) worst = { metric: m, ageMs: age };
  }
  return worst;
}

// ---------- tones ----------

export function stateTone(state: ResourceState | null): StatusTone | null {
  return state ? (state.toLowerCase() as StatusTone) : null;
}

/** Accepted is green; "could not act" is grey; refusals and malformed requests take the faulted tone. */
export function acceptanceTone(a: Acceptance): StatusTone {
  if (a === "Accepted") return "available";
  if (a === "Offline" || a === "NotAvailable") return "unavailable";
  return "faulted";
}

// ---------- envelope ----------

/** Setpoint range [-maxImportKw, maxExportKw] — the type only decides which end is 0. */
export function setpointRange(r: Resource): [number, number] | null {
  if (r.maxImportKw === null || r.maxExportKw === null) return null;
  return [-r.maxImportKw, r.maxExportKw];
}

export function rangeLabel(r: Resource): string {
  const range = setpointRange(r);
  if (!range) return "[—]";
  return `[${fmtNum(range[0])}, ${range[1] > 0 ? "+" : ""}${fmtNum(range[1])}]`;
}

/**
 * A setpoint is a target: the resource applies the nearest value its granularity allows.
 * Zero is always reachable — below a continuous band's floor it is the only option.
 */
export function nearestReachable(g: ControlGranularity, targetKw: number): number {
  if (g.mode === "Continuous" && targetKw >= g.minKw && targetKw <= g.maxKw) return targetKw;
  const candidates = g.mode === "Steps" ? g.stepsKw : [g.minKw, g.maxKw, 0];
  return candidates.reduce((best, s) => (Math.abs(s - targetKw) < Math.abs(best - targetKw) ? s : best), candidates[0] ?? 0);
}

export function granularityLabel(g: ControlGranularity | null): string {
  if (!g) return "—";
  return g.mode === "Steps" ? `Steps · ${g.stepsKw.length}` : "Continuous";
}

export function granularityDetail(g: ControlGranularity | null): string {
  if (!g) return "—";
  if (g.mode === "Continuous") return `${fmtNum(g.minKw)} … ${fmtNum(g.maxKw)} kW`;
  const steps = [...g.stepsKw].sort((a, b) => a - b);
  if (steps.length <= 6) return `[${steps.map((s) => fmtNum(s)).join(", ")}] kW`;
  // Long lists (an AC charger has one step per amp) read better as a band plus zero.
  const nonZero = steps.filter((s) => s !== 0);
  const zero = steps.includes(0) ? ", plus 0" : "";
  return `${steps.length} steps · ${fmtNum(nonZero[0])} … ${fmtNum(nonZero[nonZero.length - 1])} kW${zero}`;
}

// ---------- activations ----------

/**
 * The setpoint a resource is holding now: unexpired, and Accepted (or not yet answered).
 * Any other acceptance means the resource never took it on. Null under own control.
 */
export function activeSetpoint(c: ActivationRecord | null, now: number = Date.now()): ActivationRecord | null {
  const holding =
    !!c && c.command === "Setpoint" && (c.endsAt === null || c.endsAt > now) && (!c.ack || c.ack.acceptance === "Accepted");
  return holding ? c : null;
}

/** What the resource achieved — only meaningful once it accepted the command. */
export function appliedKw(a: ActivationRecord): number | null {
  return a.ack?.acceptance === "Accepted" ? a.appliedKw : null;
}

/** Sum of measuredPower over resources whose values are current — dropped links and faults are excluded. */
export function fleetPower(resources: Resource[]): { net: number; importKw: number; exportKw: number } {
  let importKw = 0;
  let exportKw = 0;
  for (const r of resources) {
    if (r.state === "Unavailable" || r.state === "Faulted") continue;
    const p = metric(r, "measuredPower");
    if (p === null) continue;
    if (p < 0) importKw -= p;
    else exportKw += p;
  }
  return { net: exportKw - importKw, importKw, exportKw };
}

export function overBound(a: ActivationRecord): boolean {
  return a.ack?.latencyMs != null && a.ack.latencyMs > ACK_BOUND_MS;
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

// ---------- formatting ----------

export function fmtNum(n: number, digits = 1): string {
  const rounded = Number(n.toFixed(digits));
  const s = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits);
  return s.replace("-", "−");
}

export function formatSigned(n: number, digits = 1): string {
  const body = fmtNum(Math.abs(n), digits);
  return n > 0 ? `+${body}` : n < 0 ? `−${body}` : body;
}

export function formatKw(kw: number | null, digits = 1): string {
  return kw === null ? "—" : `${formatSigned(kw, digits)} kW`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${fmtNum(ms / 1000, 1)} s`;
  return `${Math.round(ms / 60_000)} min`;
}

export function formatAgo(atMs: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - atMs) / 1000));
  if (s < 1) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.round(m / 60)} h`;
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** 24-hour wall clock, as the design writes it: 13:34:37 or 13:34:37.482. */
export function formatClock(atMs: number | null, precision: "min" | "s" | "ms" = "s"): string {
  if (atMs === null) return "—";
  const d = new Date(atMs);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (precision === "min") return hm;
  const hms = `${hm}:${pad(d.getSeconds())}`;
  return precision === "s" ? hms : `${hms}.${pad(d.getMilliseconds(), 3)}`;
}
