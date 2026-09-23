import type { ReactNode } from "react";
import type { StatusTone } from "../../types";
import "./DataDisplay.css";

/**
 * DER PowerBar — generator convention: export grows right in sage, import grows left in sky,
 * from a zero tick. `value` is signed kW, `max` the magnitude that fills one half.
 */
export function PowerBar({ value, max }: { value: number | null; max: number }) {
  const share = value === null || max <= 0 ? 0 : Math.min(1, Math.abs(value) / max);
  const width = `${share * 100}%`;
  return (
    <div className="power-bar" aria-hidden="true">
      <div className="power-bar-half power-bar-import">
        {value !== null && value < 0 && <div className="power-bar-indicator" style={{ width }} />}
      </div>
      <div className="power-bar-zero" />
      <div className="power-bar-half power-bar-export">
        {value !== null && value > 0 && <div className="power-bar-indicator" style={{ width }} />}
      </div>
    </div>
  );
}

/** DER TimelineItem — a state-coloured dot on a rail, title + mono time, description. */
export function TimelineItem({
  status,
  title,
  time,
  description,
  showConnector = true,
}: {
  status: StatusTone;
  title: ReactNode;
  time: string;
  description: ReactNode;
  showConnector?: boolean;
}) {
  return (
    <div className={`timeline-item timeline-item-${status}`}>
      <div className="timeline-rail">
        <span className="timeline-dot" />
        {showConnector && <span className="timeline-connector" />}
      </div>
      <div className="timeline-body">
        <div className="timeline-top">
          <span className="timeline-title">{title}</span>
          <span className="timeline-time">{time}</span>
        </div>
        <p className="timeline-description">{description}</p>
      </div>
    </div>
  );
}

/** DER KeyValue — API field name in mono, value right-aligned. */
export function KeyValue({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="key-value">
      <span className="key-value-key">{name}</span>
      <span className="key-value-value">{children}</span>
    </div>
  );
}
