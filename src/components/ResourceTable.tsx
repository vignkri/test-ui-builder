import type { Resource } from "../types";
import { STATUS_LABEL, TYPE_LABEL } from "../data/resources";
import { StatusBadge, TypeBadge } from "./Badge";
import "./ResourceTable.css";

interface Props {
  resources: Resource[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ResourceTable({ resources, selectedId, onSelect }: Props) {
  return (
    <div className="resource-table-wrap">
      <table className="resource-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Site</th>
            <th>Status</th>
            <th>Power</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((r) => (
            <tr
              key={r.id}
              className={r.id === selectedId ? "row-selected" : ""}
              onClick={() => onSelect(r.id)}
            >
              <td className="mono cell-id">{r.id}</td>
              <td>
                <TypeBadge type={r.type} label={TYPE_LABEL[r.type]} />
              </td>
              <td className="cell-muted">{r.site}</td>
              <td>
                <StatusBadge status={r.status} label={STATUS_LABEL[r.status]} />
              </td>
              <td className="cell-muted">
                {r.currentPowerKw.toFixed(1)} / {r.powerLimitKw.toFixed(1)} kW
              </td>
            </tr>
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
