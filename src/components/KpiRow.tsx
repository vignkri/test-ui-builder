import type { Resource } from "../types";
import "./KpiRow.css";

export function KpiRow({ resources }: { resources: Resource[] }) {
  const total = resources.length;
  const needsAttention = resources.filter((r) => r.status === "needs-attention").length;
  const fault = resources.filter((r) => r.status === "fault").length;
  const totalPowerKw = resources.reduce((sum, r) => sum + r.currentPowerKw, 0);

  const items = [
    { label: "Resources", value: total.toLocaleString() },
    { label: "Needs attention", value: needsAttention.toLocaleString(), tone: "amber" as const },
    { label: "Fault", value: fault.toLocaleString(), tone: "red" as const },
    { label: "Live load", value: `${totalPowerKw.toFixed(1)} kW` },
  ];

  return (
    <div className="kpi-row">
      {items.map((item) => (
        <div className="kpi-card" key={item.label}>
          <p className="kpi-label">{item.label}</p>
          <p className={`kpi-value ${item.tone ? `kpi-value-${item.tone}` : ""}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}
