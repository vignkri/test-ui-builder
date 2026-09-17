import { useState } from "react";
import type { FeedEntry, Resource } from "../types";
import {
  TYPE_LABEL,
  ackTone,
  displayAck,
  formatAgo,
  formatClock,
  formatUntil,
  maxPowerKw,
  stateTone,
} from "../mqtt/derive";
import { sendEvActivation, sendHpActivation } from "../mqtt/fleet";
import { Badge } from "./Badge";
import "./ResourceDetail.css";

type Tab = "Control" | "Telemetry" | "Registration";
const TABS: Tab[] = ["Control", "Telemetry", "Registration"];

interface Props {
  resource: Resource | null;
  feed: FeedEntry[];
  now: number;
  live: boolean;
}

export function ResourceDetail({ resource, feed, now, live }: Props) {
  if (!resource) {
    return (
      <div className="detail-card detail-empty">
        <p>{live ? "Select a resource to see its detail." : "No resources — not connected."}</p>
      </div>
    );
  }
  return <ResourceDetailPanel key={resource.id} resource={resource} feed={feed} now={now} live={live} />;
}

function ResourceDetailPanel({
  resource: r,
  feed,
  now,
  live,
}: {
  resource: Resource;
  feed: FeedEntry[];
  now: number;
  live: boolean;
}) {
  const isHp = r.type === "heat-pump";
  const max = maxPowerKw(r);
  const [tab, setTab] = useState<Tab>("Control");
  const [limit, setLimit] = useState(r.activation?.powerLimitKw ?? max);
  const invalid = Number.isNaN(limit) || limit < 0 || limit > max;
  const canSend = live && !invalid;

  const endsAt = r.activation?.endsAt ?? null;
  const roundTrip = r.acknowledgement?.roundTripMs ?? null;
  const ownFeed = feed.filter((e) => e.resourceId === r.id);

  return (
    <div className={`detail-card ${isHp ? "accent-blue" : ""}`}>
      <div className="detail-head">
        <div className="detail-head-row">
          <p className="detail-id">{r.id}</p>
          <Badge tone={isHp ? "blue" : "green"}>{TYPE_LABEL[r.type]}</Badge>
        </div>
        <p className="mono detail-topic">
          {r.zone}/{r.customer}/v1/activation/{r.id}
        </p>
      </div>

      <div className="detail-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`detail-tab ${t === tab ? "detail-tab-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="detail-body">
        <div className="status-tiles">
          <div className="status-tile">
            <p className="status-tile-label">State</p>
            <p className={`status-tile-value text-${stateTone(r)}`}>{r.status ?? "—"}</p>
          </div>
          {isHp ? (
            <div className="status-tile">
              <p className="status-tile-label">available_kw</p>
              <p className="status-tile-value">
                {r.availableUpKw === null ? "—" : `↑${r.availableUpKw.toFixed(1)} ↓${(r.availableDownKw ?? 0).toFixed(1)}`}
              </p>
            </div>
          ) : (
            <div className="status-tile">
              <p className="status-tile-label">power_kw</p>
              <p className="status-tile-value">{r.powerKw === null ? "—" : `${r.powerKw.toFixed(1)} kW`}</p>
            </div>
          )}
          <div className="status-tile">
            <p className="status-tile-label">acceptance</p>
            <p className={`status-tile-value text-${ackTone(r)}`}>{displayAck(r)}</p>
          </div>
        </div>

        {tab === "Control" && (
          <>
            <section className="detail-section">
              <p className="detail-section-label">ACTIVATION · {isHp ? "Direction" : "SetPowerLimit"}</p>
              {isHp ? (
                <div className="detail-actions">
                  <button type="button" className="btn btn-tonal" disabled={!live} onClick={() => sendHpActivation(r, "Release")}>
                    Release
                  </button>
                  <button type="button" className="btn btn-soft" disabled={!live} onClick={() => sendHpActivation(r, "ActivationDown")}>
                    Down
                  </button>
                  <button type="button" className="btn btn-solid" disabled={!live} onClick={() => sendHpActivation(r, "ActivationUp")}>
                    Up
                  </button>
                </div>
              ) : (
                <>
                  <label className="text-field">
                    <span className="text-field-label">Power limit (kW)</span>
                    <input
                      type="number"
                      className={`text-field-input ${invalid ? "text-field-invalid" : ""}`}
                      min={0}
                      max={max}
                      step={0.1}
                      value={Number.isNaN(limit) ? "" : limit}
                      onChange={(e) => setLimit(parseFloat(e.target.value))}
                    />
                    <span className={`text-field-helper ${invalid ? "text-red" : ""}`}>
                      Max {max} kW for this charge point
                    </span>
                  </label>
                  <div className="detail-actions">
                    <button
                      type="button"
                      className="btn btn-tonal"
                      disabled={!live}
                      onClick={() => sendEvActivation(r, "ClearPowerLimit")}
                    >
                      Clear limit
                    </button>
                    <button
                      type="button"
                      className="btn btn-solid"
                      disabled={!canSend}
                      onClick={() => sendEvActivation(r, "SetPowerLimit", limit)}
                    >
                      Send activation
                    </button>
                  </div>
                </>
              )}
              <div className="kv-row">
                <span className="kv-key">ends_at</span>
                <span className="kv-value">
                  {endsAt ? `${formatClock(endsAt)} · ${formatUntil(endsAt, now)}` : "—"}
                </span>
              </div>
              {!isHp && (
                <div className="kv-row">
                  <span className="kv-key">Round trip</span>
                  <span className={`kv-value ${roundTrip !== null && roundTrip <= 2000 ? "text-green" : ""}`}>
                    {roundTrip === null ? "—" : `${roundTrip} ms`}
                  </span>
                </div>
              )}
            </section>

            <section className="detail-section">
              <p className="detail-section-label">{isHp ? "AVAILABILITY · v1/measurement" : "POWER · v1/power"}</p>
              {isHp ? (
                <>
                  <div className="kv-row">
                    <span className="kv-key">availableUpKw</span>
                    <span className="kv-value">{r.availableUpKw === null ? "—" : `${r.availableUpKw.toFixed(1)} kW`}</span>
                  </div>
                  <div className="kv-row">
                    <span className="kv-key">availableDownKw</span>
                    <span className="kv-value">{r.availableDownKw === null ? "—" : `${r.availableDownKw.toFixed(1)} kW`}</span>
                  </div>
                </>
              ) : (
                <>
                  <Sparkline values={r.powerHistoryKw} limit={r.activation?.powerLimitKw ?? max} />
                  <div className="kv-row">
                    <span className="kv-key">Latest</span>
                    <span className="kv-value">{r.powerKw === null ? "—" : `${r.powerKw.toFixed(1)} kW`}</span>
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {tab === "Telemetry" && (
          <section className="detail-section">
            <p className="detail-section-label">TELEMETRY · last {ownFeed.length} messages</p>
            {ownFeed.length === 0 && <p className="text-field-helper">No messages yet.</p>}
            {ownFeed.map((e) => (
              <div className="kv-row" key={e.id}>
                <span className="kv-key mono">v1/{e.channel}</span>
                <span className="kv-value">
                  {e.summary} <span className="text-muted">· {formatAgo(e.at, now)}</span>
                </span>
              </div>
            ))}
          </section>
        )}

        {(tab === "Control" || tab === "Registration") && (
          <section className="detail-section">
            <p className="detail-section-label">REGISTRATION · v1/register</p>
            {isHp ? (
              <>
                <div className="kv-row">
                  <span className="kv-key">compressorRatedPowerKW</span>
                  <span className="kv-value">{r.compressorRatedPowerKW ?? "—"}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-key">backupHeaterRatedPowerKW</span>
                  <span className="kv-value">{r.backupHeaterRatedPowerKW ?? "—"}</span>
                </div>
              </>
            ) : (
              <>
                <div className="kv-row">
                  <span className="kv-key">capability</span>
                  <span className="kv-value">{r.capability.length ? r.capability.join(", ") : "—"}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-key">current_type</span>
                  <span className="kv-value">{r.currentType ?? "—"}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-key">schedule</span>
                  <span className="kv-value">
                    {r.schedule ? `${r.schedule.starts_at} – ${r.schedule.ends_at}` : "—"}
                  </span>
                </div>
                <div className="kv-row">
                  <span className="kv-key">BRP (GS1)</span>
                  <span className="kv-value mono">{r.brpCode ?? "—"}</span>
                </div>
              </>
            )}
            <div className="kv-row">
              <span className="kv-key">subscription_status</span>
              <span className={`kv-value ${r.subscriptionStatus === "Subscribed" ? "text-green" : "text-red"}`}>
                {r.subscriptionStatus}
              </span>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Sparkline({ values, limit }: { values: number[]; limit: number }) {
  const max = Math.max(limit, ...values, 1);
  if (values.length === 0) {
    return <div className="sparkline sparkline-empty">No power samples yet</div>;
  }
  return (
    <div className="sparkline">
      {values.map((v, i) => (
        <div
          key={i}
          className={`sparkline-bar ${v >= limit * 0.85 ? "sparkline-bar-hot" : ""}`}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
