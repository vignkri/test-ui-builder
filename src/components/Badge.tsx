import type { ResourceStatus, ResourceType } from "../types";
import "./Badge.css";

export function StatusBadge({ status, label }: { status: ResourceStatus; label: string }) {
  return <span className={`badge badge-status-${status}`}>{label}</span>;
}

export function TypeBadge({ type, label }: { type: ResourceType; label: string }) {
  return <span className={`badge badge-type-${type}`}>{label}</span>;
}
