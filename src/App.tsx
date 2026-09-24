import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { AppSidebar, ConnectionAlert, EmptyNamespace, MobileNav, PageHeader } from "./components/shell/Shell";
import { QUICKSTART_URL, zoneLabel, type ZoneFilter } from "./components/shell/zone";
import { Input } from "./components/ui/Inputs";
import { activeSetpoint } from "./mqtt/derive";
import { CUSTOMER, retryConnection } from "./mqtt/fleet";
import type { FleetSnapshot } from "./mqtt/store";
import { useConnectionStatus, useFleet, useNow } from "./mqtt/useFleet";
import { SCREEN_LABEL, useIsMobile, useRoute, type Screen } from "./routes";
import { useTheme } from "./theme";
import { AcknowledgementsScreen } from "./screens/AcknowledgementsScreen";
import { ActivationsScreen } from "./screens/ActivationsScreen";
import { EventsScreen } from "./screens/EventsScreen";
import { OverviewScreen } from "./screens/OverviewScreen";
import { RegistrationScreen } from "./screens/RegistrationScreen";
import { ResourcesScreen } from "./screens/ResourcesScreen";
import "./App.css";

const SUBTITLE: Record<Screen, string> = {
  overview: "Flexibility your resources offer right now, by type and direction.",
  resources: "Live state for every resource on your namespace — one message set for every type.",
  activations: "Commands sent on v2/activation, what each resource applied, and how it answered.",
  events: "Every change a resource reports on v2/events — state transitions, faults, and dropped connections.",
  acknowledgements: "Every activation is answered. The acknowledgement separates a refusal to act from a lost link — power values alone can't.",
  registration: "What each resource declared on v2/register and v2/update — its envelope, granularity and configuration.",
};

const CHANNEL: Record<Screen, string> = {
  overview: "",
  resources: " / {channel} / {resourceId}",
  activations: " / activation / +",
  events: " / events / +",
  acknowledgements: " / acknowledgement / +",
  registration: " / register",
};

function byZone(s: FleetSnapshot, zone: ZoneFilter): FleetSnapshot {
  if (zone === "all") return s;
  return {
    ...s,
    resources: s.resources.filter((r) => r.zone === zone),
    activations: s.activations.filter((a) => a.zone === zone),
    events: s.events.filter((e) => e.zone === zone),
    legacy: s.legacy.filter((l) => l.zone === zone),
  };
}

function App() {
  const fleet = useFleet();
  const status = useConnectionStatus();
  const live = status.kind === "live";
  const now = useNow(1000);
  const [theme, toggleTheme] = useTheme();
  const [route, navigate] = useRoute();
  const isMobile = useIsMobile();
  const [zone, setZone] = useState<ZoneFilter>("all");
  const [search, setSearch] = useState("");

  const snapshot = useMemo(() => byZone(fleet, zone), [fleet, zone]);
  const { screen } = route;
  const counts: Partial<Record<Screen, number>> = {
    resources: snapshot.resources.length,
    activations: snapshot.resources.filter((r) => activeSetpoint(r.command, now)).length,
  };
  const empty = live && snapshot.resources.length === 0 && snapshot.legacy.length === 0;
  const props = { snapshot, now, live, isMobile, selectedId: route.id, navigate };

  const actions =
    screen === "resources" && !isMobile ? (
      <>
        <Input
          className="header-search"
          icon={<Search />}
          type="search"
          placeholder="Search resourceId…"
          aria-label="Search resourceId"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <a className="button button-default button-size-default" href={QUICKSTART_URL} target="_blank" rel="noreferrer">
          <BookOpen />
          Register resources
        </a>
      </>
    ) : undefined;

  return (
    <div className={`app-shell ${live ? "" : "app-offline"}`}>
      <AppSidebar active={screen} counts={counts} status={status} theme={theme} onToggleTheme={toggleTheme} />
      <main className="app-main">
        <PageHeader
          breadcrumb={`${zoneLabel(zone)} / ${CUSTOMER} / v2${CHANNEL[screen]}`}
          title={screen === "resources" ? "Distributed resources" : screen === "overview" ? "Fleet overview" : SCREEN_LABEL[screen]}
          subtitle={SUBTITLE[screen]}
          zone={zone}
          onZoneChange={setZone}
          actions={actions}
        />
        <ConnectionAlert status={status} onRetry={retryConnection} />
        {empty ? (
          <EmptyNamespace zone={zone} customer={CUSTOMER} />
        ) : (
          <div className="app-content">
            {screen === "overview" && <OverviewScreen {...props} zone={zone} />}
            {screen === "resources" && <ResourcesScreen {...props} search={search} />}
            {screen === "activations" && <ActivationsScreen {...props} />}
            {screen === "events" && <EventsScreen {...props} />}
            {screen === "acknowledgements" && <AcknowledgementsScreen {...props} />}
            {screen === "registration" && <RegistrationScreen {...props} />}
          </div>
        )}
      </main>
      <MobileNav active={screen} />
    </div>
  );
}

export default App;
