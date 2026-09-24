import type { Resource, ResourceType } from "../types";
import { ZONES, type Zone } from "../mqtt/topics";
import {
  MARKETS,
  STALE_AFTER_MS,
  TYPE_LABEL,
  TYPE_ORDER,
  ZONE_MARKETS,
  fmtNum,
  formatClock,
  formatDuration,
  metric,
  oldestGap,
  stateTone,
} from "../mqtt/derive";
import { FreshnessBadge, StatusBadge } from "../components/ui/Badge";
import { Card, KpiCard } from "../components/ui/Card";
import { FleetPowerKpi } from "./ResourcesScreen";
import type { ScreenProps } from "./types";
import "./screens.css";
import "./Overview.css";

/** Values are summed as published — headroom is already net of site limits, never recomputed. */
function sum(resources: Resource[], m: "availablePowerUp" | "availablePowerDown" | "availableEnergyUp" | "availableEnergyDown"): number {
  return resources.reduce((s, r) => s + (r.state === "Unavailable" || r.state === "Faulted" ? 0 : (metric(r, m) ?? 0)), 0);
}

export function OverviewScreen({ snapshot, now, live, navigate, zone }: ScreenProps & { zone: "all" | Zone }) {
  const { resources } = snapshot;
  const batteries = resources.filter((r) => r.type === "bess");

  return (
    <>
      <div className="kpi-grid">
        <KpiCard
          label="Available power ↑"
          tone="available"
          value={`${fmtNum(sum(resources, "availablePowerUp"))} kW`}
          caption="Consumption to shed or output to add · sum of availablePowerUp"
        />
        <KpiCard
          label="Available power ↓"
          tone="activated"
          value={`${fmtNum(sum(resources, "availablePowerDown"))} kW`}
          caption="Consumption to add or output to drop · sum of availablePowerDown"
        />
        <KpiCard
          label="Battery energy"
          value={`${fmtNum(sum(batteries, "availableEnergyUp"))} / ${fmtNum(sum(batteries, "availableEnergyDown"))} kWh`}
          caption={`availableEnergyUp / availableEnergyDown · ${batteries.length} ${batteries.length === 1 ? "battery" : "batteries"}`}
        />
        <FleetPowerKpi resources={resources} />
      </div>

      <div className="screen-split screen-split-wide">
        <FlexibilityCard resources={resources} />
        <div className="overview-bounds">
          {(zone === "all" ? ZONES : [zone]).map((z) => (
            <MarketBoundsCard key={z} zone={z} />
          ))}
        </div>
      </div>

      <HealthCard resources={resources} now={now} live={live} onOpen={(id) => navigate("resources", id)} />
    </>
  );
}

function FlexibilityCard({ resources }: { resources: Resource[] }) {
  const rows = TYPE_ORDER.map((t) => {
    const of = resources.filter((r) => r.type === t);
    const dispatchable = of.filter((r) => r.state !== "Unavailable" && r.state !== "Faulted");
    return { type: t, count: of.length, up: sum(dispatchable, "availablePowerUp"), down: sum(dispatchable, "availablePowerDown"), dispatchable: dispatchable.length };
  }).filter((row) => row.count > 0);
  const scale = Math.max(1, ...rows.flatMap((r) => [r.up, r.down]));

  return (
    <Card title="Flexibility by resource type" action={<span className="card-meta">kW · from current operating point</span>}>
      <div className="card-body">
        <div className="chip-row overview-legend">
          <span>
            <span className="legend-swatch legend-import" />↓ down — add consumption / drop output
          </span>
          <span>
            <span className="legend-swatch legend-export" />↑ up — shed consumption / add output
          </span>
        </div>
        <div className="flex-rows">
          {rows.map((row) => (
            <FlexRow key={row.type} {...row} scale={scale} />
          ))}
          {rows.length === 0 && <p className="card-note">No registered resources in this zone.</p>}
        </div>
        <p className="card-note">
          Values are summed as published. Headroom is already net of site limits and reservations, so the console never
          recomputes it from ratings.
        </p>
      </div>
    </Card>
  );
}

function FlexRow({ type, count, up, down, dispatchable, scale }: { type: ResourceType; count: number; up: number; down: number; dispatchable: number; scale: number }) {
  return (
    <div className="flex-row">
      <div>
        <p className="flex-row-label">{TYPE_LABEL[type]}</p>
        <p className="flex-row-code">
          {type} · {count}
        </p>
      </div>
      <div className="flex-bar" aria-hidden="true">
        <div className="flex-bar-half flex-bar-down">
          <div style={{ width: `${(down / scale) * 100}%` }} />
        </div>
        <div className="flex-bar-zero" />
        <div className="flex-bar-half flex-bar-up">
          <div style={{ width: `${(up / scale) * 100}%` }} />
        </div>
      </div>
      <p className="flex-row-values">{dispatchable === 0 ? "unavailable" : `↓ ${fmtNum(down)}  ↑ ${fmtNum(up)}`}</p>
    </div>
  );
}

function MarketBoundsCard({ zone }: { zone: Zone }) {
  const z = ZONE_MARKETS[zone];
  return (
    <Card title={`Market bounds · ${zone}`} action={<span className="card-meta">{z.area}</span>}>
      <div className="card-body">
        <table className="table bounds-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>Data freq</th>
              <th>Roundtrip</th>
              <th>Lag</th>
            </tr>
          </thead>
          <tbody>
            {z.markets.map((m) => (
              <tr key={m}>
                <td className="bounds-market">{m}</td>
                <td>{formatDuration(MARKETS[m].dataFrequencyMs)}</td>
                <td>{formatDuration(MARKETS[m].roundtripMs)}</td>
                <td>{formatDuration(MARKETS[m].deliveryLagMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="card-note">
          Enrolment is commercial data the platform owns. The console uses these bounds only to judge telemetry gaps and
          acknowledgement latency.
        </p>
      </div>
    </Card>
  );
}

function HealthCard({ resources, now, live, onOpen }: { resources: Resource[]; now: number; live: boolean; onOpen: (id: string) => void }) {
  const states = ["Available", "Activated", "Unavailable", "Faulted"] as const;
  const count = (s: (typeof states)[number]) => resources.filter((r) => r.state === s).length;
  const total = Math.max(1, resources.length);

  const attention = resources
    .map((r) => {
      if (r.state === "Unavailable") {
        const e = r.lastEvent;
        return {
          r,
          title: e?.lastWill ? `ConnectionLost · Last Will received ${formatClock(e.receivedAt)}` : `${e?.code ?? "Unavailable"}${e?.description ? ` · ${e.description}` : ""}`,
          detail: `Severity ${e?.severity ?? "—"} · awaiting reconnect`,
          stale: false,
          faulted: false,
        };
      }
      if (r.state === "Faulted") {
        const f = r.fault;
        return {
          r,
          title: `Error ${f?.code ?? ""}${f?.description ? ` · ${f.description}` : ""}`,
          detail: `Severity ${f?.severity ?? "—"} · since ${formatClock(f?.receivedAt ?? null)}`,
          stale: false,
          faulted: true,
        };
      }
      const gap = live ? oldestGap(r, now) : null;
      if (gap) {
        return {
          r,
          title: `Telemetry gap · no ${gap.metric} for ${Number.isFinite(gap.ageMs) ? formatDuration(gap.ageMs) : "this session"}`,
          detail: `Above the slowest market data frequency (${formatDuration(STALE_AFTER_MS)}) · flagged stale`,
          stale: true,
          faulted: false,
        };
      }
      return null;
    })
    .filter((x) => x !== null);

  return (
    <Card title="Resource health" action={<span className="card-meta">{resources.length} resources</span>}>
      <div className="card-body">
        <div className="health-bar" aria-hidden="true">
          {states.map((s) => (
            <div key={s} className={`health-bar-${s.toLowerCase()}`} style={{ width: `${(count(s) / total) * 100}%` }} />
          ))}
        </div>
        <div className="chip-row">
          {states.map((s) => (
            <span key={s} className="health-legend">
              <StatusBadge status={stateTone(s)!} />
              <strong>{count(s)}</strong>
            </span>
          ))}
        </div>
        {attention.length > 0 && (
          <div className="list-rows">
            {attention.map(({ r, title, detail, stale, faulted }) => (
              <button key={r.id} type="button" className="list-row list-row-button" onClick={() => onOpen(r.id)}>
                <span className="cell-mono">{r.id}</span>
                <span>{r.state && <StatusBadge status={stateTone(r.state)!} />}</span>
                <span>
                  <span className={`list-row-title ${faulted ? "cell-faulted" : ""}`}>{title}</span>
                  <span className="list-row-detail">{detail}</span>
                </span>
                <span>{stale && <FreshnessBadge freshness="stale" />}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
