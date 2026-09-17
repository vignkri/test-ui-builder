import type { ConnectionStatus } from "../types";
import "./TopHeader.css";

const BADGE: Record<ConnectionStatus["kind"], { label: string; tone: string }> = {
  live: { label: "Sandbox · MQTT live", tone: "green" },
  connecting: { label: "Connecting…", tone: "slate" },
  reconnecting: { label: "Reconnecting…", tone: "amber" },
  disconnected: { label: "Not connected", tone: "red" },
};

export function TopHeader({ status }: { status: ConnectionStatus }) {
  const badge = BADGE[status.kind];
  return (
    <header className="top-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">Weavemancer</span>
      </div>
      <div className="top-header-spacer" />
      <span className={`env-badge env-badge-${badge.tone}`} title={status.detail}>
        {badge.label}
      </span>
      <span className="org-name">acme-flex</span>
    </header>
  );
}
