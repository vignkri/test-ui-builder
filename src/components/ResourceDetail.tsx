import { useState } from "react";
import type { Resource } from "../types";
import { STATUS_LABEL, TYPE_LABEL } from "../data/resources";
import { StatusBadge, TypeBadge } from "./Badge";
import "./ResourceDetail.css";

interface Props {
  resource: Resource | null;
}

export function ResourceDetail({ resource }: Props) {
  if (!resource) {
    return (
      <div className="resource-detail resource-detail-empty">
        <p>Select a resource to see its detail.</p>
      </div>
    );
  }

  return <ResourceDetailPanel key={resource.id} resource={resource} />;
}

function ResourceDetailPanel({ resource }: { resource: Resource }) {
  const [limit, setLimit] = useState(resource.powerLimitKw);
  const outOfRange = limit < 0 || limit > resource.maxPowerKw;

  return (
    <div className="resource-detail">
      <div className="detail-header">
        <p className="detail-title">Resource detail</p>
        <div className="detail-id-row">
          <span className="mono detail-id">{resource.id}</span>
          <TypeBadge type={resource.type} label={TYPE_LABEL[resource.type]} />
        </div>
        <StatusBadge status={resource.status} label={STATUS_LABEL[resource.status]} />
      </div>

      <dl className="detail-facts">
        <div>
          <dt>Site</dt>
          <dd>{resource.site}</dd>
        </div>
        <div>
          <dt>Last seen</dt>
          <dd>{resource.lastSeen}</dd>
        </div>
        <div>
          <dt>Current draw</dt>
          <dd>{resource.currentPowerKw.toFixed(1)} kW</dd>
        </div>
      </dl>

      <div className="power-limit-section">
        <p className="section-heading">Power limit</p>
        <div className="power-limit-control">
          <input
            type="range"
            min={0}
            max={resource.maxPowerKw}
            step={0.1}
            value={limit}
            onChange={(e) => setLimit(parseFloat(e.target.value))}
          />
          <input
            type="number"
            className="power-limit-input"
            min={0}
            max={resource.maxPowerKw}
            step={0.1}
            value={limit}
            onChange={(e) => setLimit(parseFloat(e.target.value) || 0)}
          />
          <span className="cell-muted">kW</span>
        </div>
        <p className={`helper-text ${outOfRange ? "helper-text-error" : ""}`}>
          Must be between 0 and {resource.maxPowerKw} kW
        </p>
        <button type="button" className="apply-button" disabled={outOfRange}>
          Apply SetPowerLimit
        </button>
      </div>

      <div className="activity-section">
        <p className="section-heading">Activity</p>
        <ul className="activity-list">
          {resource.activity.map((event) => (
            <li key={event.id} className="activity-item">
              <span className="mono activity-topic">{event.topic}</span>
              <span className="mono activity-payload">{event.payload}</span>
              <span className="activity-time">{event.at}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
