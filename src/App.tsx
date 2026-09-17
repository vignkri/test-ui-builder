import { useMemo, useState } from "react";
import { RESOURCES } from "./data/resources";
import { TopHeader } from "./components/TopHeader";
import { SideNav, type Section } from "./components/SideNav";
import { PageHeader } from "./components/PageHeader";
import { KpiRow } from "./components/KpiRow";
import { MapView } from "./components/MapView";
import { EventFeed } from "./components/EventFeed";
import { ResourceTable } from "./components/ResourceTable";
import { ResourceDetail } from "./components/ResourceDetail";
import "./App.css";

const SECTION_TITLE: Record<Section, string> = {
  all: "Distributed energy resources",
  "ev-charger": "Distributed energy resources",
  "heat-pump": "Distributed energy resources",
  faults: "Faults",
  map: "Live fleet map",
};

function App() {
  const [section, setSection] = useState<Section>("ev-charger");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(RESOURCES[0]?.id ?? null);

  const sectionResources = useMemo(() => {
    switch (section) {
      case "ev-charger":
        return RESOURCES.filter((r) => r.type === "ev-charger");
      case "heat-pump":
        return RESOURCES.filter((r) => r.type === "heat-pump");
      case "faults":
        return RESOURCES.filter((r) => r.status === "fault" || r.status === "needs-attention");
      default:
        return RESOURCES;
    }
  }, [section]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sectionResources;
    return sectionResources.filter((r) => r.id.toLowerCase().includes(query));
  }, [sectionResources, search]);

  const selected = RESOURCES.find((r) => r.id === selectedId) ?? null;
  const zones = new Set(RESOURCES.map((r) => r.zone));
  const subtitle =
    section === "map"
      ? `Markers pulse on every MQTT message · ${RESOURCES.length} shown`
      : `${sectionResources.length} resources across ${[...zones].sort().join(" and ")} · updated 4s ago`;

  return (
    <div className="app-shell">
      <TopHeader />
      <div className="app-body">
        <SideNav active={section} onSelect={setSection} />
        <main className="app-main">
          <PageHeader title={SECTION_TITLE[section]} subtitle={subtitle} />
          <KpiRow resources={RESOURCES} />
          <div className="app-content">
            {section === "map" ? (
              <>
                <MapView resources={RESOURCES} selectedId={selectedId} onSelect={setSelectedId} />
                <EventFeed />
              </>
            ) : (
              <>
                <ResourceTable
                  resources={filtered}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  search={search}
                  onSearchChange={setSearch}
                />
                <ResourceDetail resource={selected} />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
