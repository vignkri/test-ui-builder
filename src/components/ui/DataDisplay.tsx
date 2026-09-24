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

/**
 * DER EnvelopeTrack — the setpoint range [-maxImportKw, maxExportKw] with the import zone in sky,
 * the export zone in sage, a zero tick, the measured position, reachable steps and the setpoint.
 */
export function EnvelopeTrack({
  minKw,
  maxKw,
  measuredKw,
  setpointKw,
  setpointLabel,
  stepsKw,
}: {
  minKw: number;
  maxKw: number;
  measuredKw: number | null;
  setpointKw: number | null;
  setpointLabel?: string;
  stepsKw?: number[];
}) {
  const span = maxKw - minKw || 1;
  const fraction = (kw: number) => (Math.min(maxKw, Math.max(minKw, kw)) - minKw) / span;
  const at = (kw: number) => `${fraction(kw) * 100}%`;
  const labelEdge =
    setpointKw === null ? "" : fraction(setpointKw) < 0.15 ? "envelope-setpoint-label-start" : fraction(setpointKw) > 0.85 ? "envelope-setpoint-label-end" : "";
  const zero = at(0);
  const measured =
    measuredKw === null || measuredKw === 0
      ? null
      : { left: at(Math.min(0, measuredKw)), right: at(Math.max(0, measuredKw)), dir: measuredKw < 0 ? "import" : "export" };
  return (
    <div className="envelope-track" aria-hidden="true">
      {minKw < 0 && <div className={`envelope-zone envelope-zone-import ${maxKw > 0 ? "" : "envelope-zone-whole"}`} style={{ left: 0, right: `calc(100% - ${zero})` }} />}
      {maxKw > 0 && <div className={`envelope-zone envelope-zone-export ${minKw < 0 ? "" : "envelope-zone-whole"}`} style={{ left: zero, right: 0 }} />}
      {measured && (
        <div
          className={`envelope-measured envelope-measured-${measured.dir}`}
          style={{ left: measured.left, right: `calc(100% - ${measured.right})` }}
        />
      )}
      {stepsKw?.map((s) => (
        <span key={s} className="envelope-step" style={{ left: at(s) }} />
      ))}
      <div className="envelope-zero" style={{ left: zero }} />
      {setpointKw !== null && (
        <>
          <div className="envelope-setpoint" style={{ left: at(setpointKw) }} />
          {setpointLabel && (
            <span className={`envelope-setpoint-label ${labelEdge}`} style={{ left: at(setpointKw) }}>
              {setpointLabel}
            </span>
          )}
        </>
      )}
    </div>
  );
}

/** DER CodeBlock — raw payload viewer with its topic above. */
export function CodeBlock({ topic, code }: { topic: string; code: object | string }) {
  return (
    <div className="code-block">
      <p className="code-block-topic">{topic}</p>
      <pre className="code-block-pre">{typeof code === "string" ? code : JSON.stringify(code, null, 2)}</pre>
    </div>
  );
}
