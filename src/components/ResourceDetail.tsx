import { useState } from "react";
import type { Resource } from "../types";
import { TYPE_LABEL } from "../data/resources";
import { Badge } from "./Badge";
import "./ResourceDetail.css";

type Tab = "Control" | "Telemetry" | "Registration";
const TABS: Tab[] = ["Control", "Telemetry", "Registration"];

interface Props {
  resource: Resource | null;
}

export function ResourceDetail({ resource }: Props) {
  if (!resource) {
    return (
      <div className="detail-card detail-empty">
        <p>Select a resource to see its detail.</p>
      </div>
    );
  }
  return <ResourceDetailPanel key={resource.id} resource={resource} />;
}

function ResourceDetailPanel({ resource }: { resource: Resource }) {
  const isHeatPump = resource.type === "heat-pump";
  const [tab, setTab] = useState<Tab>("Control");
  const [limit, setLimit] = useState(resource.powerLimitKw);
  const [sentLimit, setSentLimit] = useState<number | null>(null);

  const outOfRange = Number.isNaN(limit) || limit < 0 || limit > resource.maxPowerKw;
  const stateTone =
    resource.state === "Offline" ? "text-red" : resource.state === "Available" ? "" : "text-green";
  const ackTone =
    resource.ack === "Accepted"
      ? "text-green"
      : resource.ack === "Pending"
        ? "text-amber"
        : resource.ack === "EvseOffline"
          ? "text-red"
          : "";

  return (
    <div className={`detail-card ${isHeatPump ? "accent-blue" : ""}`}>
      <div className="detail-head">
        <div className="detail-head-row">
          <p className="detail-id">{resource.id}</p>
          <Badge tone={isHeatPump ? "blue" : "green"}>{TYPE_LABEL[resource.type]}</Badge>
        </div>
        <p className="mono detail-topic">
          {resource.zone}/acme-flex/v1/activation/{resource.id}
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
            <p className={`status-tile-value ${stateTone}`}>{resource.state}</p>
          </div>
          <div className="status-tile">
            <p className="status-tile-label">power_kw</p>
            <p className="status-tile-value">{resource.currentPowerKw.toFixed(1)} kW</p>
          </div>
          <div className="status-tile">
            <p className="status-tile-label">acceptance</p>
            <p className={`status-tile-value ${ackTone}`}>{resource.ack ?? "—"}</p>
          </div>
        </div>

        {tab === "Control" && (
          <>
            <section className="detail-section">
              <p className="detail-section-label">
                ACTIVATION · {isHeatPump ? "Direction" : "SetPowerLimit"}
              </p>
              <label className="text-field">
                <span className="text-field-label">Power limit (kW)</span>
                <input
                  type="number"
                  className={`text-field-input ${outOfRange ? "text-field-invalid" : ""}`}
                  min={0}
                  max={resource.maxPowerKw}
                  step={0.1}
                  value={Number.isNaN(limit) ? "" : limit}
                  onChange={(e) => setLimit(parseFloat(e.target.value))}
                />
                <span className={`text-field-helper ${outOfRange ? "text-red" : ""}`}>
                  Max {resource.maxPowerKw} kW for this {isHeatPump ? "heat pump" : "charge point"}
                </span>
              </label>
              <div className="detail-actions">
                <button
                  type="button"
                  className="btn btn-tonal"
                  onClick={() => {
                    setLimit(resource.powerLimitKw);
                    setSentLimit(null);
                  }}
                >
                  Clear limit
                </button>
                <button
                  type="button"
                  className="btn btn-solid"
                  disabled={outOfRange}
                  onClick={() => setSentLimit(limit)}
                >
                  Send activation
                </button>
              </div>
              <div className="kv-row">
                <span className="kv-key">ends_at</span>
                <span className="kv-value">{resource.endsAt} · in 56 min</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Round trip</span>
                <span className="kv-value text-green">{resource.roundTripMs} ms</span>
              </div>
              {sentLimit !== null && (
                <div className="kv-row">
                  <span className="kv-key">Last sent</span>
                  <span className="kv-value">SetPowerLimit {sentLimit.toFixed(1)} kW</span>
                </div>
              )}
            </section>

            <section className="detail-section">
              <p className="detail-section-label">POWER · v1/power</p>
              <Sparkline values={resource.powerHistoryKw} limit={resource.powerLimitKw} />
              <div className="kv-row">
                <span className="kv-key">Latest</span>
                <span className="kv-value">{resource.currentPowerKw.toFixed(1)} kW</span>
              </div>
            </section>
          </>
        )}

        {tab === "Telemetry" && (
          <section className="detail-section">
            <p className="detail-section-label">TELEMETRY · recent messages</p>
            {resource.activity.map((event) => (
              <div className="kv-row" key={event.id}>
                <span className="kv-key mono">{event.topic}</span>
                <span className="kv-value">
                  {event.payload} <span className="text-muted">· {event.at}</span>
                </span>
              </div>
            ))}
          </section>
        )}

        {(tab === "Control" || tab === "Registration") && (
          <section className="detail-section">
            <p className="detail-section-label">REGISTRATION · v1/register</p>
            <div className="kv-row">
              <span className="kv-key">capability</span>
              <span className="kv-value">{resource.capability}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">current_type</span>
              <span className="kv-value">{resource.currentType}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">subscription_status</span>
              <span
                className={`kv-value ${
                  resource.subscriptionStatus === "Subscribed" ? "text-green" : "text-red"
                }`}
              >
                {resource.subscriptionStatus}
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-key">schedule</span>
              <span className="kv-value">{resource.schedule}</span>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Sparkline({ values, limit }: { values: number[]; limit: number }) {
  const max = Math.max(limit, ...values, 1);
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
