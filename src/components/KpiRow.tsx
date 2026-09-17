import type { Resource } from "../types";
import { ACK_TARGET_MS } from "../mqtt/derive";
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

  const items = [
    {
      label: "Registered",
      value: resources.length,
      helper: `${evCount} chargers · ${hpCount} heat pumps`,
      tone: "neutral",
    },
    {
      label: "Online",
      value: resources.length - offline,
      helper: `${offline} offline or unavailable`,
      tone: offline > 0 ? "amber" : "green",
    },
    {
      label: "Active activations",
      value: active.length,
      helper: `${powerLimits} power limits · ${active.length - powerLimits} directional`,
      tone: "blue",
    },
    {
      label: "Unacknowledged",
      value: unacknowledged,
      helper: unacknowledged > 0 ? "Exceeds 2 s ack target" : "All within 2 s ack target",
      tone: unacknowledged > 0 ? "red" : "green",
    },
  ];

  return (
    <div className="kpi-row">
      {items.map((item) => (
        <div className="kpi-card" key={item.label}>
          <p className="kpi-label">{item.label}</p>
          <p className="kpi-value">{item.value.toLocaleString()}</p>
          <p className={`kpi-helper kpi-helper-${item.tone}`}>{item.helper}</p>
        </div>
      ))}
    </div>
  );
}
