import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { EventRecord } from "../types";
import { SEVERITIES, type Severity } from "../mqtt/messages";
import { formatClock, freshnessOf, stateTone } from "../mqtt/derive";
import { EventKindBadge, SeverityBadge, StatusBadge } from "../components/ui/Badge";
import { Card, KpiCard } from "../components/ui/Card";
import { CodeBlock } from "../components/ui/DataDisplay";
import { Toggle } from "../components/ui/Inputs";
import type { ScreenProps } from "./types";
import "../components/ui/Table.css";
import "./screens.css";
import "./Log.css";

function detail(e: EventRecord): { primary: string; secondary: string | null; faulted: boolean } {
  if (e.lastWill) return { primary: "ConnectionLost · Last Will", secondary: "resourceTimestamp null — platform stamped receipt", faulted: false };
  if (e.eventKind === "Error") {
    return {
      primary: [e.code, e.description].filter(Boolean).join(" · ") || "Equipment fault",
      secondary: "code and description are partner free text",
      faulted: true,
    };
  }
  if (e.sessionState) return { primary: `sessionState: ${e.sessionState}`, secondary: e.description ?? "OCPP session state sits beside resourceState", faulted: false };
  if (e.description || e.code) {
    const affirmative = e.resourceState === "Unavailable" ? "Affirmative Unavailable — not inferred from silence" : null;
    return { primary: e.description ?? e.code ?? "", secondary: e.description && e.code ? e.code : affirmative, faulted: false };
  }
  return { primary: `${e.eventKind} · ${e.resourceState}`, secondary: null, faulted: false };
}

export function EventsScreen({ snapshot, now, live }: ScreenProps) {
  const { events, resources } = snapshot;
  const [kind, setKind] = useState<"all" | "Status" | "Error">("all");
  const [severities, setSeverities] = useState<Set<Severity>>(new Set());
  const visible = useMemo(
    () => events.filter((e) => (kind === "all" || e.eventKind === kind) && (severities.size === 0 || severities.has(e.severity))),
    [events, kind, severities]
  );

  const errors = events.filter((e) => e.eventKind === "Error").length;
  const transitions = events.filter((e) => e.previousState !== null && e.previousState !== e.resourceState);
  const wills = events.filter((e) => e.lastWill);
  const affirmative = events.filter((e) => e.resourceState === "Unavailable" && !e.lastWill).length;
  const faulted = resources.filter((r) => r.state === "Faulted");
  const staleNow = resources.filter((r) => r.state !== "Unavailable" && freshnessOf(r, live, now) === "stale").length;

  const toggleSeverity = (s: Severity) =>
    setSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  return (
    <>
      <div className="kpi-grid">
        <KpiCard label="Events" value={events.length} caption={`Status ${events.length - errors} · Error ${errors}`} />
        <KpiCard
          label="State transitions"
          tone="activated"
          value={transitions.length}
          caption={`Across ${new Set(transitions.map((e) => e.resourceId)).size} resources`}
        />
        <KpiCard label="Last Will received" tone="unavailable" value={wills.length} caption="Connection closed without a disconnect" />
        <KpiCard
          label="Open faults"
          tone="faulted"
          value={faulted.length}
          caption={faulted.length ? faulted.map((r) => `${r.id}${r.fault?.code ? ` · ${r.fault.code}` : ""}`).join(", ") : "No resource is Faulted"}
        />
      </div>

      <div className="chip-row">
        <span className="chip-row-label">Kind</span>
        {(["all", "Status", "Error"] as const).map((k) => (
          <Toggle key={k} pressed={kind === k} onPressedChange={() => setKind(k)}>
            {k === "all" ? "All" : k}
          </Toggle>
        ))}
        <span className="chip-row-label">Severity</span>
        {SEVERITIES.map((s) => (
          <Toggle key={s} pressed={severities.has(s)} onPressedChange={() => toggleSeverity(s)}>
            {s}
          </Toggle>
        ))}
        <span className="chip-row-aside">Newest first · QoS 1</span>
      </div>

      <div className="screen-split">
        <Card>
          <div className="table-scroll">
            <table className="table log-table">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Resource</th>
                  <th>Kind</th>
                  <th>Transition</th>
                  <th>Severity</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => {
                  const d = detail(e);
                  const changed = e.previousState !== null && e.previousState !== e.resourceState;
                  return (
                    <tr key={e.messageId} className={e.lastWill ? "table-row-selected" : ""}>
                      <td className="cell-time">{formatClock(e.receivedAt, "ms")}</td>
                      <td className="cell-mono">{e.resourceId}</td>
                      <td>
                        <EventKindBadge kind={e.eventKind} />
                      </td>
                      <td>
                        <span className="transition">
                          {changed && (
                            <>
                              <StatusBadge status={stateTone(e.previousState)!} />
                              <ArrowRight aria-label="to" />
                            </>
                          )}
                          <StatusBadge status={stateTone(e.resourceState)!} />
                        </span>
                      </td>
                      <td>
                        <SeverityBadge severity={e.severity} />
                      </td>
                      <td className="cell-wrap">
                        <p className={`cell-primary ${d.faulted ? "cell-faulted" : ""}`}>{d.primary}</p>
                        {d.secondary && <p className="cell-secondary">{d.secondary}</p>}
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td className="cell-empty" colSpan={6}>
                      No events on v2/events match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Liveness" description="There is no heartbeat on this API. The console layers three signals and labels which one fired.">
          <div className="card-body">
            <div className="liveness-layers">
              <Layer n={1} title="Last Will and Testament" code="Connection liveness" count={`${wills.length} this session`}>
                Broker publishes Unavailable when a resource's connection drops.
              </Layer>
              <Layer n={2} title="Affirmative Unavailable" code="Resource liveness" count={`${affirmative} this session`}>
                Mandatory event when the resource stops being dispatchable.
              </Layer>
              <Layer n={3} title="Gap detection" code="Backstop" count={`${staleNow} stale now`}>
                Silence longer than the market data frequency is flagged as stale — never as a state.
              </Layer>
            </div>
            {wills[0] && <CodeBlock topic={`Last Will payload · ${wills[0].resourceId}`} code={wills[0].raw} />}
          </div>
        </Card>
      </div>
    </>
  );
}

function Layer({ n, title, code, count, children }: { n: number; title: string; code: string; count: string; children: string }) {
  return (
    <div className={`liveness-layer liveness-layer-${n}`}>
      <span className="liveness-n">{n}</span>
      <p className="liveness-title">{title}</p>
      <p className="liveness-count">{count}</p>
      <p className="liveness-code">{code}</p>
      <p className="liveness-text">{children}</p>
    </div>
  );
}
