import { useMemo, useState } from "react";
import { TopHeader } from "./components/TopHeader";
import { SideNav, type Section } from "./components/SideNav";
import { PageHeader } from "./components/PageHeader";
import { KpiRow } from "./components/KpiRow";
import { MapView } from "./components/MapView";
import { EventFeed } from "./components/EventFeed";
import { ResourceTable } from "./components/ResourceTable";
import { ResourceDetail } from "./components/ResourceDetail";
import { formatAgo, healthOf } from "./mqtt/derive";
import { useConnectionStatus, useFleet, useNow } from "./mqtt/useFleet";
import "./App.css";

const SECTION_TITLE: Record<Section, string> = {
  all: "Distributed energy resources",
  "ev-charger": "Distributed energy resources",
  "heat-pump": "Distributed energy resources",
  faults: "Faults",
  map: "Live fleet map",
};

const OFFLINE_COPY: Record<Exclude<ConnectionKind, "live">, string> = {
  connecting: "Connecting to the broker",
  reconnecting: "Connection to the broker was lost — retrying",
  disconnected: "Not connected to the broker",
};
type ConnectionKind = ReturnType<typeof useConnectionStatus>["kind"];

function App() {
  const { resources, feed, lastMessageAt } = useFleet();
  const status = useConnectionStatus();
  const live = status.kind === "live";
  const now = useNow(1000);
  const [section, setSection] = useState<Section>("ev-charger");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sectionResources = useMemo(() => {
    switch (section) {
      case "ev-charger":
        return resources.filter((r) => r.type === "ev-charger");
      case "heat-pump":
        return resources.filter((r) => r.type === "heat-pump");
      case "faults":
        return resources.filter((r) => {
          const h = healthOf(r, now);
          return h === "fault" || h === "needs-attention";
        });
      default:
        return resources;
    }
  }, [resources, section, now]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sectionResources;
    return sectionResources.filter((r) => r.id.toLowerCase().includes(query));
  }, [sectionResources, search]);

  // Keep the detail panel on something that is actually in the visible list.
  const visibleSelectedId =
    section === "map"
      ? selectedId
      : filtered.some((r) => r.id === selectedId)
        ? selectedId
        : (filtered[0]?.id ?? null);
  const selected = resources.find((r) => r.id === visibleSelectedId) ?? null;

  const zones = [...new Set(resources.map((r) => r.zone))].sort().join(" and ");
  const ago = lastMessageAt ? formatAgo(lastMessageAt, now) : null;
  const updated = ago === null ? "no messages yet" : ago === "now" ? "updated just now" : `updated ${ago} ago`;
  const subtitle =
    section === "map"
      ? `Markers pulse on every MQTT message · ${resources.length} shown`
      : `${sectionResources.length} resources${zones ? ` across ${zones}` : ""} · ${updated}`;

  return (
    <div className={`app-shell ${live ? "" : "app-offline"}`}>
      <TopHeader status={status} />
      {!live && (
        <div className="offline-banner" role="status">
          <span className="offline-banner-title">{OFFLINE_COPY[status.kind]}</span>
          <span className="offline-banner-detail">{status.detail}</span>
          {resources.length > 0 && <span className="offline-banner-detail">Showing last known state.</span>}
        </div>
      )}
      <div className="app-body">
        <SideNav active={section} onSelect={setSection} />
        <main className="app-main">
          <PageHeader title={SECTION_TITLE[section]} subtitle={subtitle} />
          <KpiRow resources={resources} now={now} />
          <div className="app-content">
            {section === "map" ? (
              <>
                <MapView resources={resources} selectedId={selectedId} onSelect={setSelectedId} />
                <EventFeed feed={feed} now={now} live={live} />
              </>
            ) : (
              <>
                <ResourceTable
                  resources={filtered}
                  selectedId={visibleSelectedId}
                  onSelect={setSelectedId}
                  search={search}
                  onSearchChange={setSearch}
                />
                <ResourceDetail resource={selected} feed={feed} now={now} live={live} />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
