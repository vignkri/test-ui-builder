import { useMemo, useState } from "react";
import { WifiOff } from "lucide-react";
import { AppSidebar, type Section } from "./components/AppSidebar";
import { PageHeader, type ZoneFilter } from "./components/PageHeader";
import { KpiRow } from "./components/KpiRow";
import { MapView } from "./components/MapView";
import { EventFeed } from "./components/EventFeed";
import { ResourceTable } from "./components/ResourceTable";
import { ResourceDetail } from "./components/ResourceDetail";
import { Alert } from "./components/ui/Feedback";
import { formatAgo, healthOf } from "./mqtt/derive";
import { CUSTOMER } from "./mqtt/fleet";
import { useConnectionStatus, useFleet, useNow } from "./mqtt/useFleet";
import { useTheme } from "./theme";
import type { Resource } from "./types";
import "./App.css";

const SECTION_TITLE: Record<Section, string> = {
  all: "Distributed resources",
  "ev-charger": "EV chargers",
  "heat-pump": "Heat pumps",
  faults: "Faults",
  map: "Live fleet map",
};

type ConnectionKind = ReturnType<typeof useConnectionStatus>["kind"];

const OFFLINE_COPY: Record<Exclude<ConnectionKind, "live">, string> = {
  connecting: "Connecting to the broker",
  reconnecting: "Connection to the broker was lost — retrying",
  disconnected: "Not connected to the broker",
};

function inSection(r: Resource, section: Section, now: number): boolean {
  switch (section) {
    case "ev-charger":
    case "heat-pump":
      return r.type === section;
    case "faults": {
      const h = healthOf(r, now);
      return h === "fault" || h === "needs-attention";
    }
    default:
      return true;
  }
}

function App() {
  const { resources, feed, lastMessageAt } = useFleet();
  const status = useConnectionStatus();
  const live = status.kind === "live";
  const now = useNow(1000);
  const [theme, toggleTheme] = useTheme();
  const [section, setSection] = useState<Section>("all");
  const [zone, setZone] = useState<ZoneFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const zoneResources = useMemo(
    () => (zone === "all" ? resources : resources.filter((r) => r.zone === zone)),
    [resources, zone]
  );

  const counts = useMemo(() => {
    const c: Partial<Record<Section, number>> = {};
    for (const s of ["all", "ev-charger", "heat-pump", "faults"] as const) {
      c[s] = zoneResources.filter((r) => inSection(r, s, now)).length;
    }
    return c;
  }, [zoneResources, now]);

  const sectionResources = useMemo(
    () => zoneResources.filter((r) => inSection(r, section, now)),
    [zoneResources, section, now]
  );

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

  const ago = lastMessageAt ? formatAgo(lastMessageAt, now) : null;
  const updated = ago === null ? "no messages yet" : ago === "now" ? "updated just now" : `updated ${ago} ago`;
  const zoneLabel = zone === "all" ? "DK1 and DK2" : zone;
  const subtitle =
    section === "map"
      ? `Markers pulse on every MQTT message · ${zoneResources.length} shown in ${zoneLabel}`
      : `${sectionResources.length} resources in ${zoneLabel} · ${updated}`;

  return (
    <div className={`app-shell ${live ? "" : "app-offline"}`}>
      <AppSidebar
        active={section}
        onSelect={setSection}
        counts={counts}
        status={status}
        customer={CUSTOMER}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main className="app-main">
        <PageHeader title={SECTION_TITLE[section]} subtitle={subtitle} zone={zone} onZoneChange={setZone} />
        {!live && (
          <Alert
            variant="destructive"
            icon={<WifiOff />}
            title={OFFLINE_COPY[status.kind]}
            description={
              resources.length > 0 ? `${status.detail} · Showing last known state.` : status.detail
            }
          />
        )}
        <KpiRow resources={zoneResources} now={now} />
        <div className="app-content">
          {section === "map" ? (
            <>
              <MapView resources={zoneResources} selectedId={selectedId} onSelect={setSelectedId} />
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
                now={now}
                live={live}
              />
              <ResourceDetail resource={selected} feed={feed} now={now} live={live} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
