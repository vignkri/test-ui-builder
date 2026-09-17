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

const SECTION_META: Record<Section, { crumbs: string[]; title: string }> = {
  map: { crumbs: ["Fleet", "acme-flex", "Map"], title: "Live fleet map" },
  "ev-charger": {
    crumbs: ["Fleet", "acme-flex", "EV chargers"],
    title: "Distributed energy resources",
  },
  "heat-pump": {
    crumbs: ["Fleet", "acme-flex", "Heat pumps"],
    title: "Distributed energy resources",
  },
  faults: { crumbs: ["Fleet", "acme-flex", "Faults"], title: "Faults" },
  registration: { crumbs: ["Fleet", "acme-flex", "Registration"], title: "Registration" },
};

function App() {
  const [section, setSection] = useState<Section>("map");
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
    return sectionResources.filter(
      (r) => r.id.toLowerCase().includes(query) || r.site.toLowerCase().includes(query)
    );
  }, [sectionResources, search]);

  const selected = RESOURCES.find((r) => r.id === selectedId) ?? null;
  const meta = SECTION_META[section];

  return (
    <div className="app-shell">
      <TopHeader />
      <div className="app-body">
        <SideNav active={section} onSelect={setSection} />
        <main className="app-main">
          <PageHeader crumbs={meta.crumbs} title={meta.title} />
          <KpiRow resources={RESOURCES} />
          {section === "map" ? (
            <div className="app-content">
              <MapView resources={RESOURCES} selectedId={selectedId} onSelect={setSelectedId} />
              <EventFeed />
            </div>
          ) : (
            <div className="app-content">
              <div className="table-column">
                <input
                  className="search-input"
                  type="search"
                  placeholder="Search by ID or site"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <ResourceTable
                  resources={filtered}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </div>
              <ResourceDetail resource={selected} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
