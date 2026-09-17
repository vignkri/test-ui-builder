import type { Resource } from "../types";
import "./KpiRow.css";

export function KpiRow({ resources }: { resources: Resource[] }) {
  const evCount = resources.filter((r) => r.type === "ev-charger").length;
  const hpCount = resources.filter((r) => r.type === "heat-pump").length;
  const online = resources.filter((r) => r.status !== "offline").length;
  const offline = resources.length - online;
  const needsAttention = resources.filter((r) => r.status === "needs-attention").length;
  const fault = resources.filter((r) => r.status === "fault").length;

  const items = [
    {
      label: "Registered resources",
      value: resources.length.toLocaleString(),
      helper: `${evCount} EV chargers · ${hpCount} heat pumps`,
      tone: "neutral" as const,
    },
    {
      label: "Online",
      value: online.toLocaleString(),
      helper: `${offline} offline in last 15 min`,
      tone: "green" as const,
    },
    {
      label: "Needs attention",
      value: needsAttention.toLocaleString(),
      helper: "power limits · activations pending",
      tone: "blue" as const,
    },
    {
      label: "Fault",
      value: fault.toLocaleString(),
      helper: "exceeds acknowledgement target",
      tone: "red" as const,
    },
  ];

  return (
    <div className="kpi-row">
      {items.map((item) => (
        <div className={`kpi-card kpi-card-${item.tone}`} key={item.label}>
          <p className="kpi-label">{item.label}</p>
          <p className="kpi-value">{item.value}</p>
          <p className="kpi-helper">{item.helper}</p>
        </div>
      ))}
    </div>
  );
}
