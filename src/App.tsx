import { useMemo, useState } from "react";
import { RESOURCES } from "./data/resources";
import { Header } from "./components/Header";
import { KpiRow } from "./components/KpiRow";
import { ResourceTable } from "./components/ResourceTable";
import { ResourceDetail } from "./components/ResourceDetail";
import "./App.css";

function App() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(RESOURCES[0]?.id ?? null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return RESOURCES.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (query && !r.id.toLowerCase().includes(query) && !r.site.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [search, typeFilter, statusFilter]);

  const selected = RESOURCES.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="app-shell">
      <Header
        count={RESOURCES.length}
        search={search}
        onSearchChange={setSearch}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />
      <KpiRow resources={RESOURCES} />
      <div className="app-main">
        <ResourceTable resources={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        <ResourceDetail resource={selected} />
      </div>
    </div>
  );
}

export default App;
