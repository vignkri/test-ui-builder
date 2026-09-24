import type { ReactNode } from "react";
import type { Resource } from "../types";
import type { ModuleGroup } from "../mqtt/messages";
import {
  TYPE_LABEL,
  TYPE_ORDER,
  fmtNum,
  formatAgo,
  granularityDetail,
  granularityLabel,
  rangeLabel,
  setpointRange,
} from "../mqtt/derive";
import { compass } from "../components/resource/describe";
import { Badge, StatusBadge, TypeBadge, VersionBadge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EnvelopeTrack, KeyValue } from "../components/ui/DataDisplay";
import { Alert } from "../components/ui/Feedback";
import type { ScreenProps } from "./types";
import "./screens.css";
import "./Registration.css";

/** The nine breaking changes in the v1 → v2 migration guide, and who has to act on each. */
const HAZARDS: { n: number; text: string; status: "handled" | "check" }[] = [
  { n: 2, text: "Heat pump availablePowerDown = compressor + heater", status: "check" },
  { n: 3, text: "availablePowerUp is a straight rename", status: "handled" },
  { n: 4, text: "Heat pumps must publish measuredPower", status: "check" },
  { n: 5, text: "Directional activation → absolute setpoint", status: "handled" },
  { n: 6, text: "SetPowerLimit / ClearPowerLimit → Setpoint / Release", status: "handled" },
  { n: 7, text: "EV declares envelope; AC granularity is Steps", status: "handled" },
  { n: 8, text: "snake_case → flat camelCase", status: "handled" },
  { n: 9, text: "Bulk, schedules, markets, heartbeat removed", status: "handled" },
];

export function RegistrationScreen({ snapshot, selectedId, navigate, now }: ScreenProps) {
  const { resources, legacy } = snapshot;
  const registered = resources.filter((r) => r.type !== null);
  const selected = registered.find((r) => r.id === selectedId) ?? registered[0] ?? null;

  return (
    <>
      <div className="screen-split screen-split-left">
        <Card title="Registry" action={<span className="card-meta">{registered.length} on v2 · {legacy.length} on v1</span>}>
          <div className="registry">
            {registered.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`registry-row ${r.id === selected?.id ? "registry-row-on" : ""}`}
                onClick={() => navigate("registration", r.id)}
              >
                <span className="registry-main">
                  <span className="cell-mono">{r.id}</span>
                  <span className="registry-meta">
                    <TypeBadge type={r.type!} />
                    <span>{granularityLabel(r.controlGranularity)}</span>
                  </span>
                </span>
                <VersionBadge version="v2" />
              </button>
            ))}
            {registered.length === 0 && <p className="card-note registry-empty">Nothing has published to v2/register yet.</p>}
            {legacy.length > 0 && (
              <div className="registry-legacy">
                <p className="registry-legacy-title">Still on v1 topics</p>
                {legacy.map((l) => (
                  <div key={l.resourceId} className="registry-legacy-row" title={`last seen ${formatAgo(l.lastSeenAt, now)} ago`}>
                    <span className="mono-code">
                      {l.resourceId} · {l.channel}
                    </span>
                    <VersionBadge version="v1" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
        {selected ? <Declaration r={selected} /> : <Card title="Declaration"><p className="card-note card-body">Select a resource.</p></Card>}
      </div>

      <div className="screen-split screen-split-wide">
        <GranularityCard resources={registered} />
        <Card title="v1 → v2 migration" action={<span className="card-meta">{legacy.length} resources · per-resource</span>}>
          <div className="card-body">
            <Alert
              variant="destructive"
              title="Hazard 1 · EV sign convention inverts"
              description="v1 power_kw 7.2 (consumption positive) becomes measuredPower −7.2. A missed flip looks like 7.2 kW export and passes every schema check."
            />
            <ol className="hazards">
              {HAZARDS.map((h) => (
                <li key={h.n} className="hazard">
                  <span className="hazard-n">{h.n}</span>
                  <span className="hazard-text">{h.text}</span>
                  <Badge variant={h.status === "handled" ? "outline" : "secondary"}>{h.status}</Badge>
                </li>
              ))}
            </ol>
            <p className="card-note">
              "handled" — the console reads the v2 shape as specified. "check" — the value is the partner's to compute; the console
              displays it as published.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}

function Declaration({ r }: { r: Resource }) {
  const range = setpointRange(r);
  const brp = r.marketRelationships.balanceResponsibleParty;
  const retailer = r.marketRelationships.retailer;
  return (
    <Card
      title={
        <span className="card-title-inline declaration-title">
          <span className="mono-code">{r.id}</span>
          <TypeBadge type={r.type!} />
        </span>
      }
      action={<StatusBadge status={r.subscriptionStatus === "Subscribed" ? "available" : "unavailable"}>{r.subscriptionStatus}</StatusBadge>}
    >
      <div className="declaration">
        <div className="declaration-col">
          <p className="detail-overline">Envelope</p>
          <div className="detail-kv">
            <KeyValue name="resourceId">{r.id} · immutable</KeyValue>
            <KeyValue name="resourceType">{r.type} · immutable</KeyValue>
            <KeyValue name="maxImportKw">{fmtNum(r.maxImportKw ?? 0)} kW</KeyValue>
            <KeyValue name="maxExportKw">{fmtNum(r.maxExportKw ?? 0)} kW</KeyValue>
            <KeyValue name="controlGranularity">
              {r.controlGranularity?.mode ?? "—"} · {granularityDetail(r.controlGranularity)}
            </KeyValue>
          </div>
          {range && (
            <>
              <EnvelopeTrack
                minKw={range[0]}
                maxKw={range[1]}
                measuredKw={null}
                setpointKw={null}
                stepsKw={r.controlGranularity?.mode === "Steps" ? r.controlGranularity.stepsKw : undefined}
              />
              <div className="detail-range-labels">
                <span className="detail-range-import">{range[0] < 0 ? `import · ${fmtNum(range[0])} kW` : "import — none"}</span>
                <span className="mono-code">{rangeLabel(r)}</span>
                <span className="detail-range-export">{range[1] > 0 ? `export · +${fmtNum(range[1])} kW` : "export — none"}</span>
              </div>
            </>
          )}
          <p className="detail-overline">Market relationships</p>
          <div className="detail-kv">
            <KeyValue name="balanceResponsibleParty">{brp ? `${brp.code} · ${brp.encoding}` : "—"}</KeyValue>
            <KeyValue name="retailer">{retailer ? `${retailer.code} · ${retailer.encoding}` : "—"}</KeyValue>
          </div>
          <p className="card-note">Markets are not declared here — enrolment is platform-owned and decides the portfolio.</p>
        </div>
        <div className="declaration-col">
          <p className="detail-overline">Configuration · {TYPE_LABEL[r.type!]}</p>
          <ConfigurationView r={r} />
        </div>
      </div>
    </Card>
  );
}

function ConfigurationView({ r }: { r: Resource }) {
  const c = r.configuration;
  const rows: [string, ReactNode][] = [];
  switch (r.type) {
    case "evCharger":
      rows.push(["currentType", c.currentType ?? "—"]);
      break;
    case "heatPump":
      rows.push(["compressorRatedPowerKw", `${c.compressorRatedPowerKw ?? "—"} kW`], ["backupHeaterRatedPowerKw", `${c.backupHeaterRatedPowerKw ?? "—"} kW`]);
      break;
    case "bess":
      rows.push(
        ["powerRatedKw / powerUsableKw", `${c.powerRatedKw ?? "—"} / ${c.powerUsableKw ?? "—"} kW`],
        ["storageRatedKwh / storageUsableKwh", `${c.storageRatedKwh ?? "—"} / ${c.storageUsableKwh ?? "—"} kWh`],
        ["minSoc / maxSoc", `${c.minSoc ?? "—"} / ${c.maxSoc ?? "—"} %`],
        ["charge / dischargeEfficiency", `${c.chargeEfficiency ?? "—"} / ${c.dischargeEfficiency ?? "—"}`]
      );
      break;
    case "pv": {
      const groups = c.moduleGroups ?? [];
      const kwp = groups.reduce((s, g) => s + g.capacityKwp, 0);
      return (
        <>
          <div className="detail-kv">
            <KeyValue name="latitude / longitude">
              {c.latitude ?? "—"} / {c.longitude ?? "—"}
            </KeyValue>
            <KeyValue name="systemLoss">{c.systemLoss === undefined ? "default 0.14" : `${c.systemLoss} (default 0.14)`}</KeyValue>
            <KeyValue name="moduleGroups">
              {groups.length} · {fmtNum(kwp)} kWp DC
            </KeyValue>
          </div>
          <div className="pv-layout">
            <Compass groups={groups} />
            <div className="pv-groups">
              {groups.map((g, i) => (
                <p key={i}>
                  <span className={`mono-code pv-group-${i % 2}`}>
                    {fmtNum(g.capacityKwp)} kWp · azimuth {g.azimuth} · {g.inclination}°
                  </span>
                  <span className="card-note">{compassName(g.azimuth)} face</span>
                </p>
              ))}
              {kwp > (r.maxExportKw ?? Infinity) && (
                <p className="card-note">
                  {fmtNum(kwp)} kWp DC on a {fmtNum(r.maxExportKw ?? 0)} kW inverter — surplus is clipped.
                </p>
              )}
            </div>
          </div>
          <Alert
            variant="destructive"
            title="Azimuth is from true south, positive toward east"
            description="South 0 · East 90 · West −90 · North ±180. A north-based tool shifts the forecast by half a day; west-positive mirrors morning and afternoon — neither is rejected by validation."
          />
        </>
      );
    }
    default:
      rows.push(["configuration", "{}"]);
  }
  return (
    <div className="detail-kv">
      {rows.map(([k, v]) => (
        <KeyValue key={k} name={k}>
          {v}
        </KeyValue>
      ))}
    </div>
  );
}

function compassName(azimuth: number): string {
  const names: Record<string, string> = { S: "South", N: "North", E: "East", W: "West", SE: "South-east", SW: "South-west", NE: "North-east", NW: "North-west" };
  return names[compass(azimuth)];
}

/** Plan view of the array: each group points along its azimuth, length by capacity. */
function Compass({ groups }: { groups: ModuleGroup[] }) {
  const max = Math.max(1, ...groups.map((g) => g.capacityKwp));
  return (
    <svg className="compass" viewBox="-80 -80 160 160" role="img" aria-label="Module group orientation">
      <circle r="60" className="compass-face" />
      <text y="-66" className="compass-label">N</text>
      <text y="74" className="compass-label">S</text>
      <text x="70" y="4" className="compass-label">E</text>
      <text x="-70" y="4" className="compass-label">W</text>
      {groups.map((g, i) => {
        const a = (g.azimuth * Math.PI) / 180;
        const len = 18 + (g.capacityKwp / max) * 36;
        // Azimuth 0 is south (down on the page); positive turns toward east (right).
        return <line key={i} x1="0" y1="0" x2={Math.sin(a) * len} y2={Math.cos(a) * len} className={`compass-arm compass-arm-${i % 2}`} />;
      })}
      <circle r="3.5" className="compass-hub" />
    </svg>
  );
}

function GranularityCard({ resources }: { resources: Resource[] }) {
  // One row per type (EV chargers split by current type), from the first resource that declares it.
  const seen = new Set<string>();
  const rows = TYPE_ORDER.flatMap((t) =>
    resources
      .filter((r) => r.type === t && r.controlGranularity && setpointRange(r))
      .filter((r) => {
        const key = t === "evCharger" ? `${t}-${r.configuration.currentType}` : t;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
  );
  return (
    <Card title="Control granularity by type" action={<span className="card-meta">the platform commands a target; resources apply the nearest reachable value</span>}>
      <div className="card-body">
        {rows.map((r) => {
          const g = r.controlGranularity!;
          const [min, max] = setpointRange(r)!;
          const span = max - min || 1;
          const at = (kw: number) => `${((kw - min) / span) * 100}%`;
          return (
            <div key={r.id} className="gran-row">
              <div>
                <p className="flex-row-label">
                  {TYPE_LABEL[r.type!]}
                  {r.type === "evCharger" && r.configuration.currentType ? ` · ${r.configuration.currentType}` : ""}
                </p>
                <p className="flex-row-code">{g.mode}</p>
              </div>
              <div className="gran-track">
                <span className="gran-line" />
                {g.mode === "Steps" ? (
                  g.stepsKw.map((s) => <span key={s} className="gran-dot" style={{ left: at(s) }} />)
                ) : (
                  <span className={`gran-band ${g.maxKw <= 0 ? "gran-band-import" : g.minKw >= 0 ? "gran-band-export" : "gran-band-both"}`} style={{ left: at(g.minKw), right: `calc(100% - ${at(g.maxKw)})` }} />
                )}
                <span className="gran-dot gran-dot-zero" style={{ left: at(0) }} />
              </div>
              <p className="gran-text">{granularityDetail(g)}</p>
            </div>
          );
        })}
        {rows.length === 0 && <p className="card-note">No registrations yet.</p>}
      </div>
    </Card>
  );
}
