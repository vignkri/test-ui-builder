import { ArrowRight } from "lucide-react";
import type { Acceptance } from "../mqtt/messages";
import { ACK_BOUND_MS, MARKETS, acceptanceTone, formatClock, percentile } from "../mqtt/derive";
import { StatusBadge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import type { ScreenProps } from "./types";
import "./screens.css";
import "./Acks.css";

const MEANING: Record<Acceptance, string> = {
  Accepted: "The resource applied the command.",
  Rejected: "The resource refused the command.",
  Offline: "Not reachable from the partner's system.",
  NotAvailable: "Reachable but not dispatchable — see reason.",
  InternalError: "Failed for a reason on the partner's side.",
  InvalidResourceId: "resourceId doesn't match a registered resource.",
  InvalidMessageFormat: "The payload could not be parsed.",
  Unauthorised: "Refused on authorisation grounds.",
};

/** v1 EV charger acceptance → v2, from the migration guide. */
const V1_MAPPING: [string, Acceptance, string?][] = [
  ["RejectedByEvse", "Rejected"],
  ["EvseOffline", "Offline"],
  ["EvDisconnected", "NotAvailable", "No vehicle connected"],
  ["NoEvCharging", "NotAvailable", "Vehicle connected but not charging"],
  ["InvalidEvseId", "InvalidResourceId"],
];

const FFR_MS = MARKETS.ffr.roundtripMs;

export function AcknowledgementsScreen({ snapshot, navigate }: ScreenProps) {
  const acked = snapshot.activations.filter((a) => a.ack);
  const count = (acc: Acceptance) => acked.filter((a) => a.ack!.acceptance === acc).length;
  const notAccepted = acked.filter((a) => a.ack!.acceptance !== "Accepted");

  const byResource = new Map<string, number[]>();
  for (const a of acked) {
    if (a.ack!.latencyMs === null) continue;
    byResource.set(a.resourceId, [...(byResource.get(a.resourceId) ?? []), a.ack!.latencyMs]);
  }
  const rows = [...byResource.entries()]
    .map(([id, values]) => ({ id, p50: percentile(values, 50)!, p95: percentile(values, 95)! }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const scaleMs = Math.max(3000, ...rows.map((r) => r.p95));
  const pct = (ms: number) => `${(Math.min(ms, scaleMs) / scaleMs) * 100}%`;
  const secs = (ms: number) => (ms / 1000).toFixed(2).replace(/0$/, "");

  // The four outcomes a working integration produces lead; the four protocol errors follow.
  const order: Acceptance[] = ["Accepted", "Rejected", "Offline", "NotAvailable", "InternalError", "InvalidResourceId", "InvalidMessageFormat", "Unauthorised"];

  return (
    <>
      <div className="ack-grid">
        {order.map((acc) => {
          const n = count(acc);
          return (
            <div key={acc} className={`ack-card ${n === 0 ? "ack-card-zero" : ""}`}>
              <div className="ack-card-head">
                <StatusBadge status={acceptanceTone(acc)}>{acc}</StatusBadge>
                <span className={`ack-card-count ack-card-count-${acceptanceTone(acc)}`}>{n}</span>
              </div>
              <p className="ack-card-text">{MEANING[acc]}</p>
            </div>
          );
        })}
      </div>

      <div className="screen-split screen-split-wide">
        <Card title="Acknowledgement latency" action={<span className="card-meta">p50 and p95 · executedAt − serverTimestamp</span>}>
          <div className="card-body">
            <div className="chip-row ack-legend">
              <span>
                <span className="legend-swatch ack-swatch-p50" />p50
              </span>
              <span>
                <span className="legend-swatch ack-swatch-p95" />p95
              </span>
              <span>
                <span className="legend-swatch ack-swatch-over" />over bound
              </span>
            </div>
            <div className="latency-chart">
              <div className="latency-axis">
                <span style={{ left: 0 }}>0 s</span>
                <span className="latency-axis-bound" style={{ left: pct(FFR_MS) }}>
                  {FFR_MS / 1000} s ffr
                </span>
                <span className="latency-axis-bound" style={{ left: pct(ACK_BOUND_MS) }}>
                  {ACK_BOUND_MS / 1000} s fcr / afrr
                </span>
                <span style={{ left: "100%" }}>{Math.round(scaleMs / 1000)} s</span>
              </div>
              {rows.map((r) => {
                const over = r.p95 > ACK_BOUND_MS;
                return (
                  <div key={r.id} className="latency-row">
                    <button type="button" className="latency-id" onClick={() => navigate("resources", r.id)}>
                      {r.id}
                    </button>
                    <div className="latency-track">
                      <div className="latency-p95" style={{ width: pct(r.p95) }} />
                      <div className="latency-p50" style={{ width: pct(r.p50) }} />
                      {over && (
                        <div
                          className="latency-over"
                          style={{ left: pct(ACK_BOUND_MS), width: `calc(${pct(r.p95)} - ${pct(ACK_BOUND_MS)})` }}
                        />
                      )}
                      <span className="latency-mark" style={{ left: pct(FFR_MS) }} />
                      <span className="latency-mark" style={{ left: pct(ACK_BOUND_MS) }} />
                    </div>
                    <span className={`latency-values ${over ? "latency-values-over" : ""}`}>
                      {secs(r.p50)} / {secs(r.p95)} s
                    </span>
                  </div>
                );
              })}
              {rows.length === 0 && <p className="card-note">No acknowledgements with executedAt yet.</p>}
            </div>
            <p className="card-note">
              Market enrolment isn't on the wire, so every resource is judged against the {ACK_BOUND_MS / 1000} s bound. A slow
              Accepted still counts as applied, but the console flags it because the response obligation may be missed.
            </p>
          </div>
        </Card>

        <div className="ack-side">
          <Card title="Not accepted" action={<span className="card-meta">{notAccepted.length} this session</span>}>
            <div className="card-body">
              {notAccepted.map((a) => (
                <button key={a.messageId} type="button" className="refusal" onClick={() => navigate("activations", a.messageId)}>
                  <span className="refusal-head">
                    <span className="cell-mono">{a.resourceId}</span>
                    <StatusBadge status={acceptanceTone(a.ack!.acceptance)}>{a.ack!.acceptance}</StatusBadge>
                  </span>
                  <span className="refusal-foot">
                    <span>
                      <span className="mono-code refusal-key">reason</span> {a.ack!.reason ?? "—"}
                    </span>
                    <span className="mono-code refusal-key">executedAt {formatClock(a.ack!.executedAt)}</span>
                  </span>
                </button>
              ))}
              {notAccepted.length === 0 && <p className="card-note">Every acknowledgement so far was Accepted.</p>}
              <p className="card-note">
                For anything other than Accepted, executedAt is the time of the decision. Type-specific detail lives in the free-text
                reason.
              </p>
              <div className="mapping">
                <p className="mapping-title">v1 EV charger → v2 mapping</p>
                {V1_MAPPING.map(([v1, v2, reason]) => (
                  <div key={v1} className="mapping-row">
                    <span className="mono-code">{v1}</span>
                    <ArrowRight aria-label="becomes" />
                    <span className="mono-code mapping-v2">{v2}</span>
                    <span className="mapping-reason">{reason ?? ""}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
