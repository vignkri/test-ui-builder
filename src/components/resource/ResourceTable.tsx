import type { Resource } from "../../types";
import { fmtNum, formatKw, freshnessOf, metric, setpointRange, stateTone } from "../../mqtt/derive";
import { Badge, StatusBadge, TypeBadge } from "../ui/Badge";
import { PowerBar } from "../ui/DataDisplay";
import { commandSummary, stateDetail } from "./describe";
import "../ui/Table.css";
import "./Resource.css";

interface Props {
  resources: Resource[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: number;
  live: boolean;
}

export function ResourceTable({ resources, selectedId, onSelect, now, live }: Props) {
  return (
    <div className="table-scroll">
      <table className="table resource-table">
        <thead>
          <tr>
            <th>Resource</th>
            <th>State</th>
            <th>Measured power</th>
            <th>Headroom ↑ / ↓</th>
            <th>Command</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((r) => (
            <ResourceRow
              key={r.id}
              resource={r}
              selected={r.id === selectedId}
              onSelect={onSelect}
              stale={freshnessOf(r, live, now) !== "live"}
              now={now}
            />
          ))}
          {resources.length === 0 && (
            <tr>
              <td className="cell-empty" colSpan={5}>
                No resources match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ResourceRow({
  resource: r,
  selected,
  onSelect,
  stale,
  now,
}: {
  resource: Resource;
  selected: boolean;
  onSelect: (id: string) => void;
  stale: boolean;
  now: number;
}) {
  const tone = stateTone(r.state);
  const detail = stateDetail(r);
  const power = metric(r, "measuredPower");
  const range = setpointRange(r);
  const up = metric(r, "availablePowerUp");
  const down = metric(r, "availablePowerDown");
  const command = commandSummary(r, now);
  // A dropped link or a fault means the last values are history, not state.
  const lastKnown = r.state === "Unavailable" || r.state === "Faulted";

  return (
    <tr
      className={[
        "table-row-interactive",
        selected ? "table-row-selected" : "",
        r.subscriptionStatus === "Unsubscribed" ? "table-row-dimmed" : "",
        stale ? "row-stale" : "",
      ].join(" ")}
      onClick={() => onSelect(r.id)}
      tabIndex={0}
      aria-selected={selected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(r.id);
        }
      }}
    >
      <td>
        <div className="cell-stack">
          <span className="cell-mono">{r.id}</span>
          {r.type ? <TypeBadge type={r.type} /> : <Badge variant="outline">unregistered</Badge>}
        </div>
      </td>
      <td>
        <div className="cell-stack">
          {tone ? <StatusBadge status={tone} /> : <Badge variant="outline">No event</Badge>}
          {detail && tone && <span className="cell-secondary">{detail}</span>}
        </div>
      </td>
      <td className="cell-power">
        <p className="cell-primary">{lastKnown || power === null ? "—" : formatKw(power)}</p>
        <PowerBar value={lastKnown ? null : power} max={range ? Math.max(-range[0], range[1]) : 1} />
        {range && (
          <p className="cell-range">
            range {fmtNum(range[0])} … +{fmtNum(range[1])} kW
          </p>
        )}
      </td>
      <td className="cell-headroom">
        <p>↑ {up === null ? "—" : fmtNum(up)}</p>
        <p>↓ {down === null ? "—" : fmtNum(down)}</p>
      </td>
      <td className="cell-command">
        <p className={`cell-primary ${command.tone === "faulted" ? "cell-faulted" : ""}`}>{command.primary}</p>
        {command.secondary && <p className="cell-secondary">{command.secondary}</p>}
      </td>
    </tr>
  );
}

/** 09a — the resource list as cards below the mobile breakpoint. */
export function ResourceCards({ resources, onSelect, now }: { resources: Resource[]; onSelect: (id: string) => void; now: number }) {
  return (
    <div className="resource-cards">
      {resources.map((r) => {
        const tone = stateTone(r.state);
        const power = metric(r, "measuredPower");
        const range = setpointRange(r);
        const lastKnown = r.state === "Unavailable" || r.state === "Faulted";
        const command = commandSummary(r, now);
        return (
          <button key={r.id} type="button" className="resource-card" onClick={() => onSelect(r.id)}>
            <span className="resource-card-row">
              <span className="cell-mono">{r.id}</span>
              {tone && <StatusBadge status={tone} />}
            </span>
            <span className="resource-card-row">
              {r.type ? <TypeBadge type={r.type} showCode={false} /> : <span />}
              <span className="resource-card-power">{lastKnown || power === null ? "—" : formatKw(power)}</span>
            </span>
            <PowerBar value={lastKnown ? null : power} max={range ? Math.max(-range[0], range[1]) : 1} />
            <span className="resource-card-row resource-card-foot">
              <span className="mono">
                ↑ {fmtNum(metric(r, "availablePowerUp") ?? 0)} ↓ {fmtNum(metric(r, "availablePowerDown") ?? 0)}
              </span>
              <span className={command.tone === "faulted" ? "cell-faulted" : ""}>{command.primary}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
