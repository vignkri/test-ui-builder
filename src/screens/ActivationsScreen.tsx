import { useMemo, useState } from "react";
import type { ActivationRecord } from "../types";
import { ACK_BOUND_MS, acceptanceTone, appliedKw, formatClock, formatDuration, formatKw, formatSigned, overBound } from "../mqtt/derive";
import { CommandBadge, StatusBadge } from "../components/ui/Badge";
import { Card, KpiCard } from "../components/ui/Card";
import { CodeBlock } from "../components/ui/DataDisplay";
import { Alert } from "../components/ui/Feedback";
import { Toggle } from "../components/ui/Inputs";
import type { ScreenProps } from "./types";
import "../components/ui/Table.css";
import "./screens.css";
import "./Log.css";

type Filter = "all" | "Setpoint" | "Release" | "notAccepted" | "overBound";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "Setpoint", label: "Setpoint" },
  { id: "Release", label: "Release" },
  { id: "notAccepted", label: "Not accepted" },
  { id: "overBound", label: "Over bound" },
];

function matches(a: ActivationRecord, f: Filter): boolean {
  switch (f) {
    case "all":
      return true;
    case "notAccepted":
      return !!a.ack && a.ack.acceptance !== "Accepted";
    case "overBound":
      return overBound(a);
    default:
      return a.command === f;
  }
}

export function ActivationsScreen({ snapshot, selectedId, navigate, isMobile }: ScreenProps) {
  const { activations, resources } = snapshot;
  const [filter, setFilter] = useState<Filter>("all");
  const visible = useMemo(() => activations.filter((a) => matches(a, filter)), [activations, filter]);
  const selected = activations.find((a) => a.messageId === selectedId) ?? (isMobile ? null : (visible[0] ?? null));

  const setpoints = activations.filter((a) => a.command === "Setpoint").length;
  const acked = activations.filter((a) => a.ack);
  const accepted = acked.filter((a) => a.ack?.acceptance === "Accepted").length;
  const notAccepted = acked.filter((a) => a.ack?.acceptance !== "Accepted");
  const breakdown = [...new Set(notAccepted.map((a) => a.ack!.acceptance))]
    .map((acc) => `${acc} ${notAccepted.filter((a) => a.ack!.acceptance === acc).length}`)
    .join(" · ");
  const over = activations.filter(overBound).length;
  const since = activations.length ? activations[activations.length - 1].receivedAt : null;

  return (
    <>
      <div className="kpi-grid">
        <KpiCard label="Sent" value={activations.length} caption={`Setpoint ${setpoints} · Release ${activations.length - setpoints}`} />
        <KpiCard
          label="Accepted"
          tone="activated"
          value={accepted}
          caption={acked.length ? `${Math.round((accepted / acked.length) * 100)} % · applied by the resource` : "No acknowledgements yet"}
        />
        <KpiCard label="Not accepted" tone="unavailable" value={notAccepted.length} caption={breakdown || "Every answer so far was Accepted"} />
        <KpiCard label="Over roundtrip bound" tone="faulted" value={over} caption={`Acknowledged later than ${formatDuration(ACK_BOUND_MS)}`} />
      </div>

      <div className="chip-row">
        {FILTERS.map((f) => (
          <Toggle key={f.id} pressed={filter === f.id} onPressedChange={() => setFilter(f.id)}>
            {f.label}
          </Toggle>
        ))}
        <span className="chip-row-aside">{since ? `Since ${formatClock(since, "min")} · this session` : "Nothing sent this session"}</span>
      </div>

      <div className="screen-split">
        <Card>
          <div className="table-scroll">
            <table className="table log-table">
              <thead>
                <tr>
                  <th>Sent</th>
                  <th>Resource</th>
                  <th>Command</th>
                  <th>Target → applied</th>
                  <th>endsAt</th>
                  <th>Acknowledgement</th>
                  <th>Latency</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => {
                  const r = resources.find((x) => x.id === a.resourceId);
                  const stepped = r?.controlGranularity?.mode === "Steps";
                  const applied = appliedKw(a);
                  return (
                    <tr
                      key={a.messageId}
                      className={`table-row-interactive ${a.messageId === selected?.messageId ? "table-row-selected" : ""}`}
                      tabIndex={0}
                      onClick={() => navigate("activations", a.messageId)}
                      onKeyDown={(e) => e.key === "Enter" && navigate("activations", a.messageId)}
                    >
                      <td className="cell-time">{formatClock(a.serverTimestamp, "ms")}</td>
                      <td className="cell-mono">{a.resourceId}</td>
                      <td>
                        <CommandBadge command={a.command} />
                      </td>
                      <td>
                        <p className="cell-primary">{a.command === "Setpoint" ? formatKw(a.setpointKw) : "—"}</p>
                        <p className="cell-secondary">
                          {a.command === "Release"
                            ? "back to own control"
                            : applied === null
                              ? ""
                              : `applied ${formatSigned(applied)}${stepped && Math.abs(applied - (a.setpointKw ?? 0)) >= 0.05 ? " · nearest step" : ""}`}
                        </p>
                      </td>
                      <td className="cell-time">{a.endsAt ? formatClock(a.endsAt) : "—"}</td>
                      <td className="cell-wrap">
                        {a.ack ? (
                          <div className="cell-stack">
                            <StatusBadge status={acceptanceTone(a.ack.acceptance)}>{a.ack.acceptance}</StatusBadge>
                            {a.ack.reason && <span className="cell-secondary">{a.ack.reason}</span>}
                          </div>
                        ) : (
                          <span className="cell-secondary">awaiting</span>
                        )}
                      </td>
                      <td>
                        <p className={`cell-primary ${overBound(a) ? "cell-faulted" : ""}`}>{formatDuration(a.ack?.latencyMs ?? null)}</p>
                        {overBound(a) && <p className="cell-secondary cell-faulted">over {formatDuration(ACK_BOUND_MS)} bound</p>}
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td className="cell-empty" colSpan={7}>
                      No commands on v2/activation match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        {selected && <ActivationDetail a={selected} />}
      </div>
    </>
  );
}

function ActivationDetail({ a }: { a: ActivationRecord }) {
  const latency = a.ack?.latencyMs ?? null;
  return (
    <aside className="detail-panel">
      <div className="detail-header-row">
        <CommandBadge command={a.command} />
        {a.ack && <StatusBadge status={acceptanceTone(a.ack.acceptance)}>{a.ack.acceptance}</StatusBadge>}
      </div>
      <h2 className="detail-id">{a.resourceId}</h2>
      <div className="timing-list">
        <Timing field="serverTimestamp" meaning="Platform sends activation" value={formatClock(a.serverTimestamp, "ms")} />
        <Timing field="executedAt" meaning="Resource applies and acknowledges" value={a.ack?.executedAt ? formatClock(a.ack.executedAt, "ms") : "—"} />
        <Timing
          field="roundtrip"
          meaning={`${latency !== null && latency > ACK_BOUND_MS ? "Over" : "Within"} the ${formatDuration(ACK_BOUND_MS)} bound`}
          value={formatDuration(latency)}
          faulted={overBound(a)}
        />
        {a.endsAt && <Timing field="endsAt" meaning="Obligation ends — resource may revert" value={formatClock(a.endsAt, "ms")} />}
      </div>
      <CodeBlock topic={`← v2/activation/${a.resourceId}`} code={a.raw} />
      {a.ack ? (
        <CodeBlock topic={`→ v2/acknowledgement/${a.resourceId}`} code={a.ack.raw} />
      ) : (
        <p className="detail-note">No acknowledgement yet. Every activation is acknowledged, for every resource type.</p>
      )}
      <Alert
        variant="accent"
        title="Stale activations"
        description="QoS 1 can redeliver an old command after reconnecting. Resources discard it if serverTimestamp is older than the market roundtrip bound on receipt, or a newer activation was already applied."
      />
    </aside>
  );
}

function Timing({ field, meaning, value, faulted = false }: { field: string; meaning: string; value: string; faulted?: boolean }) {
  return (
    <div className="timing-row">
      <div>
        <p className="timing-field">{field}</p>
        <p className="timing-meaning">{meaning}</p>
      </div>
      <span className={`timing-value ${faulted ? "cell-faulted" : ""}`}>{value}</span>
    </div>
  );
}
