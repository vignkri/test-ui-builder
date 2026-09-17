import type { Resource } from "../types";
import "./KpiRow.css";

export function KpiRow({ resources }: { resources: Resource[] }) {
  const evCount = resources.filter((r) => r.type === "ev-charger").length;
  const hpCount = resources.filter((r) => r.type === "heat-pump").length;
  const online = resources.filter((r) => r.state !== "Offline").length;
  const offline = resources.length - online;
  const withActivation = resources.filter((r) => r.activation);
  const powerLimits = withActivation.filter((r) => r.type === "ev-charger").length;
  const directional = withActivation.length - powerLimits;
  const unacknowledged = resources.filter((r) => r.ack === "Pending").length;

  const items = [
    {
      label: "Registered",
      value: resources.length.toLocaleString(),
      helper: `${evCount} chargers · ${hpCount} heat pumps`,
      tone: "neutral",
    },
    {
      label: "Online",
      value: online.toLocaleString(),
      helper: `${offline} offline in last 15 min`,
      tone: "green",
    },
    {
      label: "Active activations",
      value: withActivation.length.toLocaleString(),
      helper: `${powerLimits} power limits · ${directional} directional`,
      tone: "blue",
    },
    {
      label: "Unacknowledged",
      value: unacknowledged.toLocaleString(),
      helper: "Exceeds 2 s ack target",
      tone: "red",
    },
  ];

  return (
    <div className="kpi-row">
      {items.map((item) => (
        <div className="kpi-card" key={item.label}>
          <p className="kpi-label">{item.label}</p>
          <p className="kpi-value">{item.value}</p>
          <p className={`kpi-helper kpi-helper-${item.tone}`}>{item.helper}</p>
        </div>
      ))}
    </div>
  );
}
