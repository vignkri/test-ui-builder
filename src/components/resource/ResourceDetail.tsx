import { useState, type ReactNode } from "react";
import { ChevronLeft, Power, Zap } from "lucide-react";
import type { EventRecord, Resource } from "../../types";
import { SESSION_STATES, type MeasurementType } from "../../mqtt/messages";
import {
  ACK_BOUND_MS,
  METRIC_UNIT,
  expectedMetrics,
  fmtNum,
  formatClock,
  formatDuration,
  formatKw,
  formatSigned,
  freshnessOf,
  granularityDetail,
  activeSetpoint,
  appliedKw,
  metric,
  nearestReachable,
  rangeLabel,
  setpointRange,
  stateTone,
  acceptanceTone,
} from "../../mqtt/derive";
import { sendSetpoint } from "../../mqtt/fleet";
import { Badge, StatusBadge, TypeBadge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { MetricTile } from "../ui/Card";
import { EnvelopeTrack, KeyValue, TimelineItem } from "../ui/DataDisplay";
import { Progress } from "../ui/Feedback";
import { Input } from "../ui/Inputs";
import { compass, eventLine, measurementsTopic } from "./describe";
import { ReleaseDialog } from "./ReleaseDialog";
import "./Resource.css";

interface Props {
  resource: Resource;
  events: EventRecord[];
  now: number;
  live: boolean;
  /** Mobile: a back link to the list. */
  onBack?: () => void;
}

export function ResourceDetail({ resource: r, events, now, live, onBack }: Props) {
  const tone = stateTone(r.state);
  const own = events.filter((e) => e.resourceId === r.id).slice(0, 5);

  return (
    <aside className="detail-panel" aria-label={`${r.id} detail`}>
      {onBack && (
        <button type="button" className="detail-back" onClick={onBack}>
          <ChevronLeft /> Resources
        </button>
      )}
      <header className="detail-header">
        <div className="detail-header-row">
          {r.type ? <TypeBadge type={r.type} /> : <Badge variant="outline">unregistered</Badge>}
          {tone && <StatusBadge status={tone} />}
        </div>
        <h2 className="detail-id">{r.id}</h2>
        <p className="detail-sub">{subtitle(r)}</p>
        <SampleBox resource={r} now={now} live={live} />
      </header>

      <EnvelopeSection resource={r} />
      <MetricsSection resource={r} now={now} live={live} />
      <TypeSection resource={r} />
      <CommandSection resource={r} now={now} live={live} />
      <ConfigurationSection resource={r} />

      <Section title="Event timeline" aside={`events/${r.id}`}>
        {own.length === 0 ? (
          <p className="detail-note">No events yet.</p>
        ) : (
          <div>
            {own.map((e, i) => (
              <TimelineItem
                key={e.messageId}
                status={stateTone(e.resourceState) ?? "unavailable"}
                title={e.resourceState}
                time={formatClock(e.receivedAt)}
                description={eventLine(e)}
                showConnector={i < own.length - 1}
              />
            ))}
          </div>
        )}
      </Section>
    </aside>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="detail-section">
      <div className="detail-section-head">
        <p className="detail-overline">{title}</p>
        {aside && <span className="detail-aside">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function subtitle(r: Resource): string {
  const brp = r.marketRelationships.balanceResponsibleParty;
  const base = [r.subscriptionStatus, r.zone];
  const c = r.configuration;
  switch (r.type) {
    case "evCharger":
      return [...base, c.currentType, r.maxImportKw !== null ? `${fmtNum(r.maxImportKw)} kW` : null].filter(Boolean).join(" · ");
    case "heatPump":
      return [...base, "compressor + backup heater"].join(" · ");
    case "pv": {
      const kwp = (c.moduleGroups ?? []).reduce((s, g) => s + g.capacityKwp, 0);
      return [...base, kwp ? `${fmtNum(kwp)} kWp on ${fmtNum(r.maxExportKw ?? 0)} kW inverter` : null].filter(Boolean).join(" · ");
    }
    default:
      return [...base, brp ? `BRP ${brp.code} (${brp.encoding})` : null].filter(Boolean).join(" · ");
  }
}

function SampleBox({ resource: r, now, live }: { resource: Resource; now: number; live: boolean }) {
  const sample = r.metrics.measuredPower;
  const quiet = r.state === "Unavailable" || freshnessOf(r, live, now) !== "live";
  const lag = sample && sample.resourceTimestamp !== null ? sample.serverTimestamp - sample.resourceTimestamp : null;
  return (
    <div className="detail-topic-box">
      <p className="detail-topic">{measurementsTopic(r)}</p>
      {r.lastSampleAt === null ? (
        <p className="detail-topic-note detail-topic-note-warn">No samples yet</p>
      ) : quiet ? (
        <p className="detail-topic-note detail-topic-note-warn">
          No samples since {formatClock(r.lastSampleAt)} — values are last known
        </p>
      ) : (
        <p className="detail-topic-note">
          Last sample {formatClock(r.lastSampleAt, "ms")}
          {lag !== null && ` · ${formatDuration(lag)} broker latency`}
        </p>
      )}
    </div>
  );
}

function EnvelopeSection({ resource: r }: { resource: Resource }) {
  const range = setpointRange(r);
  const g = r.controlGranularity;
  if (!range || !g) {
    return (
      <Section title="Dispatch envelope">
        <p className="detail-note">Waiting for v2/register — the envelope is declared at registration.</p>
      </Section>
    );
  }
  const target = activeSetpoint(r.command)?.setpointKw ?? null;
  const reachable = target !== null ? nearestReachable(g, target) : null;
  const stepsNote =
    g.mode === "Steps"
      ? `Steps · ${granularityDetail(g)}. The resource applies the nearest listed value.`
      : `Continuous · ${granularityDetail(g)}. A setpoint is a target: the resource applies the nearest reachable value and measuredPower reports what it achieved.`;
  const targetNote =
    target !== null && reachable !== null && Math.abs(reachable - target) >= 0.05
      ? ` Target ${formatSigned(target)} is unreachable, so it applies ${formatSigned(reachable)}.`
      : "";
  return (
    <Section title="Dispatch envelope" aside={`${rangeLabel(r)} kW`}>
      <EnvelopeTrack
        minKw={range[0]}
        maxKw={range[1]}
        measuredKw={r.state === "Unavailable" || r.state === "Faulted" ? null : metric(r, "measuredPower")}
        setpointKw={target}
        setpointLabel={target !== null ? `${r.type === "evCharger" || r.type === "heatPump" ? "target" : "setpoint"} ${formatSigned(target)}` : undefined}
        stepsKw={g.mode === "Steps" ? g.stepsKw : undefined}
      />
      <div className="detail-range-labels">
        <span className="detail-range-import">{range[0] < 0 ? `${fmtNum(range[0])} kW · import` : "no import"}</span>
        <span className="detail-range-export">{range[1] > 0 ? `export · +${fmtNum(range[1])} kW` : "no export"}</span>
      </div>
      <p className="detail-note">
        {stepsNote}
        {targetNote}
      </p>
    </Section>
  );
}

function MetricsSection({ resource: r, now, live }: { resource: Resource; now: number; live: boolean }) {
  const expected = expectedMetrics(r.type);
  const have = expected.filter((m) => r.metrics[m]).length;
  const lastKnown = r.state === "Unavailable" || freshnessOf(r, live, now) !== "live";
  const soc = metric(r, "stateOfCharge");
  const minSoc = r.configuration.minSoc;
  return (
    <Section
      title="Live metrics"
      aside={lastKnown && r.lastSampleAt !== null ? `last known · ${formatClock(r.lastSampleAt)}` : `${have} of ${expected.length}${r.type === "bess" ? " · bess" : ""}`}
    >
      <div className={`detail-metrics ${expected.length > 3 ? "detail-metrics-2" : ""}`}>
        {expected.map((m: MeasurementType) => {
          const v = metric(r, m);
          return (
            <MetricTile
              key={m}
              name={m}
              value={v === null ? "—" : m === "measuredPower" ? formatSigned(v) : fmtNum(v)}
              unit={METRIC_UNIT[m]}
              state={lastKnown ? "stale" : "live"}
            />
          );
        })}
      </div>
      {r.type === "bess" && soc !== null && (
        <div className="detail-soc">
          <div className="detail-soc-bar">
            <Progress value={soc} tone="export" />
            {minSoc !== undefined && <span className="detail-soc-min" style={{ left: `${minSoc}%` }} />}
          </div>
          <div className="detail-range-labels">
            <span>{minSoc !== undefined ? `minSoc ${minSoc} %` : ""}</span>
            <span>Each metric is its own message · QoS 0</span>
          </div>
        </div>
      )}
    </Section>
  );
}

function TypeSection({ resource: r }: { resource: Resource }) {
  if (r.state === "Faulted" && r.fault) {
    const f = r.fault;
    return (
      <Section title="Fault">
        <div className="detail-box detail-box-faulted">
          <p className="detail-box-title">
            {[f.code, f.description].filter(Boolean).join(" · ") || "Equipment fault"}
          </p>
          <p>
            eventKind {f.eventKind} · severity {f.severity} · since {formatClock(f.receivedAt)}
          </p>
          <p>code and description are partner free text — the platform stores them and doesn't branch on them.</p>
        </div>
      </Section>
    );
  }
  if (r.state === "Unavailable" && r.lastEvent?.lastWill) {
    const e = r.lastEvent;
    return (
      <Section title="Connection">
        <div className="detail-box detail-box-muted">
          <p className="detail-box-title">ConnectionLost · Last Will</p>
          <p>
            Broker published the will at {formatClock(e.receivedAt)} · severity {e.severity}.
          </p>
          <p>resourceTimestamp is null — the will was composed at connect time.</p>
        </div>
        <p className="detail-note">
          Commands sent now are answered Offline by the partner system. Metrics stay visible but greyed, and are excluded from
          fleet totals.
        </p>
      </Section>
    );
  }
  const c = r.configuration;
  const p = metric(r, "measuredPower");
  switch (r.type) {
    case "evCharger":
      return (
        <Section title="Charging session">
          <div className="detail-chips">
            {SESSION_STATES.map((s) => (
              <span key={s} className={`detail-chip ${r.sessionState === s ? "detail-chip-on" : ""}`}>
                {s}
              </span>
            ))}
          </div>
          <p className="detail-note">sessionState is OCPP detail beside resourceState — it never decides dispatchability.</p>
          <KeyValue name="configuration.currentType">{c.currentType ?? "—"}</KeyValue>
        </Section>
      );
    case "heatPump": {
      const compressor = c.compressorRatedPowerKw ?? 0;
      const heater = c.backupHeaterRatedPowerKw ?? 0;
      const drawn = p === null ? 0 : Math.max(0, -p);
      const compressorRun = Math.min(drawn, compressor);
      const heaterRun = Math.max(0, drawn - compressor);
      const down = metric(r, "availablePowerDown");
      return (
        <Section title="Stages">
          <Stage label="Compressor" detail={`running ${fmtNum(compressorRun)} of ${fmtNum(compressor)} kW`} value={compressor ? (compressorRun / compressor) * 100 : 0} />
          <Stage
            label="Backup heater"
            detail={heaterRun > 0 ? `running ${fmtNum(heaterRun)} of ${fmtNum(heater)} kW` : `off · ${fmtNum(heater)} kW rated`}
            value={heater ? (heaterRun / heater) * 100 : 0}
          />
          {down !== null && (
            <div className="detail-box detail-box-aqua">
              <p className="detail-box-title">
                availablePowerDown = {fmtNum(Math.max(0, compressor - compressorRun))} + {fmtNum(Math.max(0, heater - heaterRun))} kW
              </p>
              <p>Compressor headroom plus the heater — not the heater alone as in v1 (migration hazard 2).</p>
            </div>
          )}
        </Section>
      );
    }
    case "pv": {
      const up = metric(r, "availablePowerUp") ?? 0;
      const producing = p ?? 0;
      const sun = producing + up;
      const groups = c.moduleGroups ?? [];
      return (
        <Section title="Curtailment">
          <div className="detail-curtail">
            <div className="detail-curtail-sun" style={{ width: `${r.maxExportKw ? Math.min(100, (sun / r.maxExportKw) * 100) : 0}%` }} />
            <div className="detail-curtail-now" style={{ width: `${r.maxExportKw ? Math.min(100, (producing / r.maxExportKw) * 100) : 0}%` }} />
          </div>
          <div className="detail-range-labels">
            <span>producing {fmtNum(producing)} kW</span>
            <span>sun allows ≈ {fmtNum(sun)} kW</span>
          </div>
          <p className="detail-note">
            Under curtailment up and down swap: up {fmtNum(up)}, down {fmtNum(metric(r, "availablePowerDown") ?? 0)}. Both fall to
            0 after sunset. The array reports its own production, not the site's net.
          </p>
          <KeyValue name="moduleGroups">
            {groups.length ? groups.map((g) => `${compass(g.azimuth)} ${fmtNum(g.capacityKwp)} kWp`).join(" · ") : "—"}
          </KeyValue>
        </Section>
      );
    }
    case "chp":
    case "p2x":
    case "misc":
      return (
        <Section title="Configuration">
          <KeyValue name="configuration">{"{}"}</KeyValue>
          <p className="detail-note">
            {r.type === "misc" ? "Other" : r.type.toUpperCase()} declares no equipment properties: the dispatch envelope comes from the
            rated power and controlGranularity alone.
          </p>
        </Section>
      );
    default:
      return null;
  }
}

function Stage({ label, detail, value }: { label: string; detail: string; value: number }) {
  return (
    <div className="detail-stage">
      <div className="detail-range-labels">
        <span className="detail-stage-label">{label}</span>
        <span>{detail}</span>
      </div>
      <Progress value={value} tone="default" />
    </div>
  );
}

function CommandSection({ resource: r, now, live }: { resource: Resource; now: number; live: boolean }) {
  const c = r.command;
  const range = setpointRange(r);
  const dispatchable = r.state !== "Unavailable" && r.state !== "Faulted";
  const held = activeSetpoint(c, now);
  const [releasing, setReleasing] = useState(false);
  const [draft, setDraft] = useState("");
  const value = parseFloat(draft);
  const invalid = draft !== "" && (Number.isNaN(value) || !range || value < range[0] || value > range[1]);
  const canSend = live && dispatchable && !!range && draft !== "" && !invalid;
  const reachable = !invalid && draft !== "" && r.controlGranularity ? nearestReachable(r.controlGranularity, value) : null;

  let card: ReactNode;
  if (!dispatchable) {
    const last = c?.command === "Setpoint" ? c : null;
    card = (
      <div className={`detail-command detail-command-${r.state === "Faulted" ? "faulted" : "muted"}`}>
        <p className="detail-command-title">Not dispatchable</p>
        <p>
          {last
            ? `Last setpoint ${formatSigned(last.setpointKw ?? 0)} at ${formatClock(last.serverTimestamp)}${last.ack ? ` → ${last.ack.acceptance}` : ""}${last.ack?.reason ? ` · “${last.ack.reason}”` : ""}`
            : "No command in this session."}
        </p>
      </div>
    );
  } else if (held) {
    const c = held;
    card = (
      <div className="detail-command detail-command-active">
        <div className="detail-command-row">
          <p className="detail-command-title">Setpoint</p>
          <p className="detail-command-value">{formatKw(c.setpointKw)}</p>
        </div>
        <p className="mono detail-command-meta">
          endsAt {formatClock(c.endsAt)} · sent {formatClock(c.serverTimestamp, "ms")}
        </p>
        {appliedKw(c) !== null && <p>Applied {formatKw(appliedKw(c))}{r.type === "pv" ? " · curtailing" : ""}</p>}
        <div className="detail-command-ack">
          {c.ack ? (
            <>
              <StatusBadge status={acceptanceTone(c.ack.acceptance)}>{c.ack.acceptance}</StatusBadge>
              <span className={c.ack.latencyMs !== null && c.ack.latencyMs > ACK_BOUND_MS ? "cell-faulted" : ""}>
                acknowledged in {formatDuration(c.ack.latencyMs)}
              </span>
            </>
          ) : (
            <span>awaiting acknowledgement</span>
          )}
        </div>
      </div>
    );
  } else {
    const last = c?.command === "Release" ? c : null;
    card = (
      <div className="detail-command detail-command-muted">
        <p className="detail-command-title">Own control logic</p>
        <p>{last ? `Released ${formatClock(last.serverTimestamp)}` : "No platform command is held."}</p>
      </div>
    );
  }

  return (
    <Section title={held ? "Active command" : "Command"}>
      {card}
      {dispatchable && range && (
        <div className="detail-controls">
          <div className="detail-setpoint">
            <Input
              type="number"
              step={0.1}
              min={range[0]}
              max={range[1]}
              placeholder={`Setpoint kW · ${fmtNum(range[0])} … ${fmtNum(range[1])}`}
              aria-label="Setpoint in kW"
              className={invalid ? "input-invalid" : ""}
              value={draft}
              disabled={!live}
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button
              icon={<Zap />}
              disabled={!canSend}
              onClick={() => {
                if (sendSetpoint(r, value)) setDraft("");
              }}
            >
              Send setpoint
            </Button>
          </div>
          {reachable !== null && Math.abs(reachable - value) >= 0.05 && (
            <p className="detail-note">Nearest reachable value: {formatKw(reachable)}.</p>
          )}
          <div className="detail-release">
            <Button variant="outline" icon={<Power />} disabled={!live} onClick={() => setReleasing(true)}>
              Release
            </Button>
            <p className="detail-note">Release returns to own control — it is not a setpoint of 0.</p>
          </div>
        </div>
      )}
      {releasing && <ReleaseDialog resource={r} onClose={() => setReleasing(false)} />}
    </Section>
  );
}

function ConfigurationSection({ resource: r }: { resource: Resource }) {
  if (r.type !== "bess") return null;
  const c = r.configuration;
  const pair = (a?: number, b?: number, unit = "") => `${a ?? "—"} / ${b ?? "—"}${unit}`;
  return (
    <Section title="Configuration" aside="replaced as a whole">
      <div className="detail-kv">
        <KeyValue name="powerRatedKw / powerUsableKw">{pair(c.powerRatedKw, c.powerUsableKw, " kW")}</KeyValue>
        <KeyValue name="storageRatedKwh">{c.storageRatedKwh ?? "—"} kWh</KeyValue>
        <KeyValue name="storageUsableKwh">{c.storageUsableKwh ?? "—"} kWh</KeyValue>
        <KeyValue name="minSoc / maxSoc">{pair(c.minSoc, c.maxSoc, " %")}</KeyValue>
        <KeyValue name="charge / dischargeEfficiency">{pair(c.chargeEfficiency, c.dischargeEfficiency)}</KeyValue>
        <KeyValue name="controlGranularity">{r.controlGranularity?.mode ?? "—"}</KeyValue>
      </div>
    </Section>
  );
}
