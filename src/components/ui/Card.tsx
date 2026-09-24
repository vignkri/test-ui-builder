import type { ReactNode } from "react";
import type { StatusTone } from "../../types";
import "./Card.css";

/** shadcn/ui Card — header (title, description, action) above free-form content. */
export function Card({
  title,
  description,
  action,
  className = "",
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-header">
          <div className="card-titles">
            {title && <h2 className="card-title">{title}</h2>}
            {description && <p className="card-description">{description}</p>}
          </div>
          {action && <div className="card-action">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export type KpiTone = "default" | StatusTone | "highlight";

/** DER KpiCard — label with tone indicator, large metric, caption. */
export function KpiCard({
  label,
  value,
  caption,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  caption: ReactNode;
  tone?: KpiTone;
}) {
  return (
    <div className={`kpi-card kpi-card-${tone}`}>
      <div className="kpi-card-header">
        <span className="kpi-card-indicator" aria-hidden="true" />
        <p className="kpi-card-label">{label}</p>
      </div>
      <p className="kpi-card-value">{value}</p>
      <p className="kpi-card-caption">{caption}</p>
    </div>
  );
}

/** DER MetricTile — API field name, value and unit; stale tiles go muted. */
export function MetricTile({
  name,
  value,
  unit,
  state = "live",
}: {
  name: string;
  value: ReactNode;
  unit?: string;
  state?: "live" | "stale";
}) {
  return (
    <div className={`metric-tile metric-tile-${state}`}>
      <p className="metric-tile-name">{name}</p>
      <div className="metric-tile-reading">
        <span className="metric-tile-value">{value}</span>
        {unit && <span className="metric-tile-unit">{unit}</span>}
      </div>
    </div>
  );
}
