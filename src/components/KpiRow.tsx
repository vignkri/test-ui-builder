import type { Resource } from "../types";
import { ACK_TARGET_MS } from "../mqtt/derive";
import { KpiCard } from "./ui/Card";
import "./KpiRow.css";

export function KpiRow({ resources, now }: { resources: Resource[]; now: number }) {
  const evCount = resources.filter((r) => r.type === "ev-charger").length;
  const hpCount = resources.length - evCount;
  const offline = resources.filter((r) => r.status === "Offline" || r.status === "Unavailable").length;
  const active = resources.filter((r) => r.activation !== null);
  const powerLimits = active.filter((r) => r.type === "ev-charger").length;
  const unacknowledged = resources.filter(
    (r) => r.ackPending && now - (r.activation?.sentAt ?? now) > ACK_TARGET_MS
  ).length;

  return (
    <div className="kpi-row">
      <KpiCard
        label="Registered"
        value={resources.length.toLocaleString()}
        caption={`${evCount} chargers · ${hpCount} heat pumps`}
      />
      <KpiCard
        label="Online"
        tone={offline > 0 ? "unavailable" : "available"}
        value={(resources.length - offline).toLocaleString()}
        caption={`${offline} offline or unavailable`}
      />
      <KpiCard
        label="Active activations"
        tone="activated"
        value={active.length.toLocaleString()}
        caption={`${powerLimits} power limits · ${active.length - powerLimits} directional`}
      />
      <KpiCard
        label="Unacknowledged"
        tone={unacknowledged > 0 ? "faulted" : "highlight"}
        value={unacknowledged.toLocaleString()}
        caption={unacknowledged > 0 ? "Exceeds 2 s ack target" : "All within 2 s ack target"}
      />
    </div>
  );
}
