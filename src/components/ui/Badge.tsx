import type { ReactNode } from "react";
import type { DerType, Freshness, StatusTone } from "../../types";
import "./Badge.css";

/** shadcn/ui Badge — variant = default | secondary | destructive | outline. */
export function Badge({
  variant = "default",
  children,
}: {
  variant?: "default" | "secondary" | "destructive" | "outline";
  children: ReactNode;
}) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

/** DER StatusBadge — pill with a state dot. The label defaults to the state name. */
export function StatusBadge({
  status,
  showDot = true,
  children,
}: {
  status: StatusTone;
  showDot?: boolean;
  children?: ReactNode;
}) {
  return (
    <span className={`badge badge-pill badge-status-${status}`}>
      {showDot && <span className="badge-dot" aria-hidden="true" />}
      {children ?? STATUS_LABEL[status]}
    </span>
  );
}

const STATUS_LABEL: Record<StatusTone, string> = {
  available: "Available",
  activated: "Activated",
  unavailable: "Unavailable",
  faulted: "Faulted",
};

const TYPE_LABEL: Record<DerType, string> = {
  evCharger: "EV charger",
  heatPump: "Heat pump",
  bess: "Battery",
  chp: "CHP",
  p2x: "P2X",
  pv: "PV",
  misc: "Other",
};

/** DER TypeBadge — resource type with its API code in mono. */
export function TypeBadge({ type, showCode = true }: { type: DerType; showCode?: boolean }) {
  return (
    <span className={`badge badge-type badge-type-${type}`}>
      {TYPE_LABEL[type]}
      {showCode && <span className="badge-code">{type}</span>}
    </span>
  );
}

/** DER FreshnessBadge — console-side data freshness, never an API field. */
export function FreshnessBadge({ freshness }: { freshness: Freshness }) {
  return (
    <span className={`badge badge-pill badge-freshness-${freshness}`}>
      {freshness === "live" && <span className="badge-dot" aria-hidden="true" />}
      {freshness === "live" ? "Live" : freshness === "stale" ? "Stale" : "Last known"}
    </span>
  );
}

/** DER CommandBadge — activation vocabulary; a release is never "setpoint 0". */
export function CommandBadge({ command }: { command: "Setpoint" | "Release" }) {
  return <span className={`badge badge-command-${command.toLowerCase()}`}>{command}</span>;
}
