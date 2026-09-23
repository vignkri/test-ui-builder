import { useState } from "react";
import { ArrowDown, ArrowUp, Power, Zap } from "lucide-react";
import type { FeedEntry, Resource } from "../types";
import {
  DER_TYPE,
  ackTone,
  displayAck,
  feedTone,
  formatAgo,
  formatClock,
  formatSigned,
  formatUntil,
  freshnessOf,
  maxPowerKw,
  signedPowerKw,
  stateTone,
} from "../mqtt/derive";
import { sendEvActivation, sendHpActivation } from "../mqtt/fleet";
import { CommandBadge, FreshnessBadge, StatusBadge, TypeBadge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card, MetricTile } from "./ui/Card";
import { KeyValue, TimelineItem } from "./ui/DataDisplay";
import { Progress } from "./ui/Feedback";
import { Input, ToggleGroup } from "./ui/Inputs";
import "./ResourceDetail.css";

type Tab = "Control" | "Telemetry" | "Registration";
const TABS = [
  { value: "Control", label: "Control" },
  { value: "Telemetry", label: "Telemetry" },
  { value: "Registration", label: "Registration" },
] as const;

interface Props {
  resource: Resource | null;
  feed: FeedEntry[];
  now: number;
  live: boolean;
}

export function ResourceDetail({ resource, feed, now, live }: Props) {
  if (!resource) {
    return (
      <Card className="detail-card detail-empty">
        <p>{live ? "Select a resource to see its detail." : "No resources — not connected."}</p>
      </Card>
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

  const freshness = freshnessOf(r, live, now);
  const tileState = freshness === "live" ? "live" : "stale";
  const state = stateTone(r);
  const ack = ackTone(r);
  const power = signedPowerKw(r);
  const endsAt = r.activation?.endsAt ?? null;
  const roundTrip = r.acknowledgement?.roundTripMs ?? null;
  const ownFeed = feed.filter((e) => e.resourceId === r.id);

  return (
    <Card className="detail-card">
      <header className="detail-head">
        <div className="detail-head-row">
          <p className="detail-id">{r.id}</p>
          <FreshnessBadge freshness={freshness} />
        </div>
        <div className="detail-badges">
          <TypeBadge type={DER_TYPE[r.type]} />
          {state && <StatusBadge status={state}>{r.status}</StatusBadge>}
        </div>
        <p className="detail-topic">
          {r.zone}/{r.customer}/v1/activation/{r.id}
        </p>
      </header>

      <div className="detail-tabs">
        <ToggleGroup label="Detail view" value={tab} options={TABS} onChange={setTab} />
      </div>

      <div className="detail-body">
        <div className="detail-tiles">
          {isHp ? (
            <>
              <MetricTile name="availableUpKw" value={r.availableUpKw?.toFixed(1) ?? "—"} unit="kW" state={tileState} />
              <MetricTile name="availableDownKw" value={r.availableDownKw?.toFixed(1) ?? "—"} unit="kW" state={tileState} />
            </>
          ) : (
            <>
              <MetricTile
                name="power_kw"
                value={power === null ? "—" : formatSigned(power)}
                unit="kW"
                state={tileState}
              />
              <MetricTile name="roundTrip" value={roundTrip ?? "—"} unit="ms" state={tileState} />
            </>
          )}
        </div>

        {tab === "Control" && (
          <>
            <section className="detail-section">
              <div className="detail-section-head">
                <p className="detail-overline">Activation · {isHp ? "Direction" : "SetPowerLimit"}</p>
                {r.activation &&
                  (r.activation.kind === "Release" || r.activation.kind === "ClearPowerLimit" ? (
                    <CommandBadge command="Release" />
                  ) : (
                    <CommandBadge command="Setpoint" />
                  ))}
              </div>
              {isHp ? (
                <div className="detail-actions">
                  <Button variant="outline" size="default" icon={<Power />} disabled={!live} onClick={() => sendHpActivation(r, "Release")}>
                    Release
                  </Button>
                  <Button variant="secondary" size="default" icon={<ArrowDown />} disabled={!live} onClick={() => sendHpActivation(r, "ActivationDown")}>
                    Down
                  </Button>
                  <Button size="default" icon={<ArrowUp />} disabled={!live} onClick={() => sendHpActivation(r, "ActivationUp")}>
                    Up
                  </Button>
                </div>
              ) : (
                <>
                  <div className="text-field">
                    <label className="text-field-label" htmlFor={`limit-${r.id}`}>
                      Power limit (kW)
                    </label>
                    <Input
                      id={`limit-${r.id}`}
                      className={invalid ? "input-invalid" : ""}
                      type="number"
                      min={0}
                      max={max}
                      step={0.1}
                      value={Number.isNaN(limit) ? "" : limit}
                      disabled={!live}
                      onChange={(e) => setLimit(parseFloat(e.target.value))}
                    />
                    <span className={`text-field-helper ${invalid ? "text-field-helper-invalid" : ""}`}>
                      Max {max} kW for this charge point
                    </span>
                  </div>
                  <div className="detail-actions">
                    <Button
                      variant="outline"
                      size="default"
                      icon={<Power />}
                      disabled={!live}
                      onClick={() => sendEvActivation(r, "ClearPowerLimit")}
                    >
                      Clear limit
                    </Button>
                    <Button size="default" icon={<Zap />} disabled={!canSend} onClick={() => sendEvActivation(r, "SetPowerLimit", limit)}>
                      Send activation
                    </Button>
                  </div>
                </>
              )}
              <div className="detail-kv">
                <KeyValue name="ends_at">{endsAt ? `${formatClock(endsAt)} · ${formatUntil(endsAt, now)}` : "—"}</KeyValue>
                {!isHp && (
                  <KeyValue name="acceptance">
                    {ack ? <StatusBadge status={ack}>{displayAck(r)}</StatusBadge> : displayAck(r)}
                  </KeyValue>
                )}
              </div>
            </section>

            {!isHp && (
              <section className="detail-section">
                <p className="detail-overline">Power · v1/power</p>
                <Sparkline values={r.powerHistoryKw} limit={r.activation?.powerLimitKw ?? max} />
                <div className="detail-limit">
                  <Progress value={r.powerKw === null ? 0 : (r.powerKw / max) * 100} tone="import" />
                  <span className="detail-limit-caption">
                    {r.powerKw === null ? "—" : `${r.powerKw.toFixed(1)} of ${max} kW`}
                  </span>
                </div>
              </section>
            )}
          </>
        )}

        {tab === "Telemetry" && (
          <section className="detail-section">
            <p className="detail-overline">Telemetry · last {ownFeed.length} messages</p>
            {ownFeed.length === 0 && <p className="text-field-helper">No messages yet.</p>}
            <div className="detail-timeline">
              {ownFeed.map((e, i) => (
                <TimelineItem
                  key={e.id}
                  status={feedTone(e)}
                  title={`v1/${e.channel}`}
                  time={`${formatClock(e.at)} · ${formatAgo(e.at, now)}`}
                  description={e.summary}
                  showConnector={i < ownFeed.length - 1}
                />
              ))}
            </div>
          </section>
        )}

        {(tab === "Control" || tab === "Registration") && (
          <section className="detail-section">
            <p className="detail-overline">Registration · v1/register</p>
            <div className="detail-kv">
              {isHp ? (
                <>
                  <KeyValue name="compressorRatedPowerKW">{r.compressorRatedPowerKW ?? "—"}</KeyValue>
                  <KeyValue name="backupHeaterRatedPowerKW">{r.backupHeaterRatedPowerKW ?? "—"}</KeyValue>
                </>
              ) : (
                <>
                  <KeyValue name="capability">{r.capability.length ? r.capability.join(", ") : "—"}</KeyValue>
                  <KeyValue name="current_type">{r.currentType ?? "—"}</KeyValue>
                  <KeyValue name="schedule">{r.schedule ? `${r.schedule.starts_at} – ${r.schedule.ends_at}` : "—"}</KeyValue>
                  <KeyValue name="brp_code">
                    <span className="mono">{r.brpCode ?? "—"}</span>
                  </KeyValue>
                </>
              )}
              <KeyValue name="subscription_status">
                <StatusBadge status={r.subscriptionStatus === "Subscribed" ? "available" : "unavailable"} showDot={false}>
                  {r.subscriptionStatus}
                </StatusBadge>
              </KeyValue>
            </div>
          </section>
        )}
      </div>
    </Card>
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
