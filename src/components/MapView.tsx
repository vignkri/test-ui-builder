import denmarkSilhouette from "../assets/map/denmark.svg";
import type { Resource } from "../types";
import { healthOf } from "../mqtt/derive";
import { useNow } from "../mqtt/useFleet";
import "./MapView.css";

/** Figma marker spec: "Updated" rings hold ~800 ms then return to Idle. */
const PULSE_WINDOW_MS = 800;

interface Props {
  resources: Resource[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function MapView({ resources, selectedId, onSelect }: Props) {
  const now = useNow(200);
  return (
    <div className="map-view">
      <p className="map-caption">Boundaries: Natural Earth 10m (public domain) &middot; Web Mercator</p>
      <img className="map-silhouette" src={denmarkSilhouette} alt="" aria-hidden="true" />
      {resources.map((r) => {
        const health = healthOf(r, now);
        const recent = now - r.lastMessageAt < PULSE_WINDOW_MS;
        return (
          <button
            key={r.id}
            type="button"
            className={[
              "map-marker",
              `map-marker-${r.type}`,
              `map-marker-health-${health}`,
              recent ? "map-marker-updated" : "",
              r.id === selectedId ? "map-marker-selected" : "",
            ].join(" ")}
            style={{ left: `${r.mapPosition.x * 100}%`, top: `${r.mapPosition.y * 100}%` }}
            title={`${r.id} · ${r.zone} · ${r.status ?? "unknown"}`}
            onClick={() => onSelect(r.id)}
          >
            <span className="map-marker-dot" />
          </button>
        );
      })}
      <div className="map-legend">
        <div className="map-legend-item">
          <span className="map-legend-dot map-legend-dot-ev" />
          EV charger
        </div>
        <div className="map-legend-item">
          <span className="map-legend-dot map-legend-dot-hp" />
          Heat pump
        </div>
        <div className="map-legend-item">
          <span className="map-legend-dot map-legend-dot-ev map-legend-pulse" />
          Updated &lt;1s ago
        </div>
      </div>
    </div>
  );
}
