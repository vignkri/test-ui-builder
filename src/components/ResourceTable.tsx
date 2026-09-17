import type { AckStatus, Resource, ResourceState } from "../types";
import { TYPE_LABEL } from "../data/resources";
import { Badge } from "./Badge";
import "./ResourceTable.css";

const STATE_TONE: Record<ResourceState, string> = {
  Charging: "text-green",
  Available: "text-low",
  ActivatedUp: "text-blue",
  ActivatedDown: "text-blue",
  Offline: "text-red",
};

function ackClass(ack: AckStatus): string {
  switch (ack) {
    case "Accepted":
      return "text-green";
    case "Pending":
      return "text-amber";
    case "EvseOffline":
      return "text-red";
    default:
      return "text-muted";
  }
}

interface Props {
  resources: Resource[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export function ResourceTable({ resources, selectedId, onSelect, search, onSearchChange }: Props) {
  return (
    <div className="resource-table-card">
      <div className="resource-table-toolbar">
        <p className="resource-table-title">Resources</p>
        <input
          className="resource-search"
          type="search"
          placeholder="Filter by ID"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <Badge tone="green">DK1</Badge>
        <Badge tone="blue">DK2</Badge>
      </div>
      <div className="resource-table-scroll">
        <table className="resource-table">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Type</th>
              <th>Zone</th>
              <th>State</th>
              <th>Activation</th>
              <th>Telemetry</th>
              <th>Ack</th>
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => (
              <tr
                key={r.id}
                className={r.id === selectedId ? "row-selected" : ""}
                onClick={() => onSelect(r.id)}
              >
                <td className="cell-id">{r.id}</td>
                <td className="text-low">{TYPE_LABEL[r.type]}</td>
                <td className="text-low">{r.zone}</td>
                <td className={STATE_TONE[r.state]}>{r.state}</td>
                <td>{r.activation ?? "—"}</td>
                <td>{r.telemetry}</td>
                <td className={ackClass(r.ack)}>{r.ack ?? "—"}</td>
              </tr>
            ))}
            {resources.length === 0 && (
              <tr>
                <td className="cell-empty" colSpan={7}>
                  No resources match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
