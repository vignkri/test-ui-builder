import denmarkSilhouette from "../assets/map/denmark.svg";
import type { Resource } from "../types";
import { MAP_BOUNDS } from "../data/resources";
import "./MapView.css";

function markerPosition(resource: Resource) {
  const x = ((resource.lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * 100;
  const y =
    100 - ((resource.lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 100;
  return { left: `${x}%`, top: `${y}%` };
}

interface Props {
  resources: Resource[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function MapView({ resources, selectedId, onSelect }: Props) {
  return (
    <div className="map-view">
      <p className="map-caption">Boundaries: Natural Earth 10m (public domain) &middot; Web Mercator</p>
      <img className="map-silhouette" src={denmarkSilhouette} alt="" aria-hidden="true" />
      {resources.map((r) => (
        <button
          key={r.id}
          type="button"
          className={`map-marker map-marker-${r.type} ${
            r.status === "needs-attention" || r.status === "fault" ? "map-marker-updated" : ""
          } ${r.id === selectedId ? "map-marker-selected" : ""}`}
          style={markerPosition(r)}
          title={`${r.id} · ${r.site}`}
          onClick={() => onSelect(r.id)}
        >
          <span className="map-marker-dot" />
        </button>
      ))}
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
          <span className="map-legend-dot map-legend-dot-alert map-legend-pulse" />
          Needs attention
        </div>
      </div>
    </div>
  );
}
