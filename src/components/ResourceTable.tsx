import { Search } from "lucide-react";
import type { Resource } from "../types";
import {
  DER_TYPE,
  ackTone,
  displayAck,
  displayActivation,
  formatClock,
  formatHeadroom,
  formatKw,
  freshnessOf,
  maxPowerKw,
  signedPowerKw,
  stateTone,
} from "../mqtt/derive";
import { Badge, StatusBadge, TypeBadge } from "./ui/Badge";
import { Card } from "./ui/Card";
import { PowerBar } from "./ui/DataDisplay";
import { Input } from "./ui/Inputs";
import "./ResourceTable.css";

interface Props {
  resources: Resource[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  now: number;
  live: boolean;
}

export function ResourceTable({ resources, selectedId, onSelect, search, onSearchChange, now, live }: Props) {
  return (
    <Card
      className="resource-table-card"
      title="Resources"
      action={
        <Input
          className="resource-search"
          icon={<Search />}
          type="search"
          placeholder="Search resourceId…"
          aria-label="Search resourceId"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      }
    >
      <div className="resource-table-scroll">
        <table className="resource-table">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Type</th>
              <th>State</th>
              <th>Power</th>
              <th>Activation</th>
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
    </Card>
  );
}

function ResourceRow({
  resource: r,
  selected,
  onSelect,
  stale,
}: {
  resource: Resource;
  selected: boolean;
  onSelect: (id: string) => void;
  stale: boolean;
}) {
  const state = stateTone(r);
  const ack = ackTone(r);
  const power = signedPowerKw(r);
  const endsAt = r.activation?.endsAt ?? null;
  const activationDetail = [endsAt === null ? null : `until ${formatClock(endsAt, false)}`, ack ? displayAck(r) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <tr
      className={[selected ? "row-selected" : "", stale ? "row-stale" : "", r.subscriptionStatus === "Unsubscribed" ? "row-dimmed" : ""].join(" ")}
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
        <p className="cell-mono">{r.id}</p>
        <p className="cell-secondary">
          {r.zone} · {r.customer}
        </p>
      </td>
      <td>
        <TypeBadge type={DER_TYPE[r.type]} showCode={false} />
      </td>
      <td>{state ? <StatusBadge status={state}>{r.status}</StatusBadge> : <Badge variant="outline">No event yet</Badge>}</td>
      <td className="cell-power">
        {r.type === "heat-pump" ? (
          <>
            <p className="cell-primary">{formatHeadroom(r)}</p>
            <p className="cell-secondary">headroom kW</p>
          </>
        ) : (
          <>
            <p className="cell-primary">{power === null ? "—" : formatKw(power)}</p>
            <PowerBar value={power} max={maxPowerKw(r)} />
          </>
        )}
      </td>
      <td>
        <p className="cell-primary">{displayActivation(r)}</p>
        {activationDetail && <p className={`cell-secondary cell-ack-${ack ?? "none"}`}>{activationDetail}</p>}
      </td>
    </tr>
  );
}
