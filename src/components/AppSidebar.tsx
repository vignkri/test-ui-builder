import { Moon, Sun } from "lucide-react";
import type { ConnectionStatus } from "../types";
import type { Theme } from "../theme";
import { Button } from "./ui/Button";
import { SidebarMenuButton, SidebarStatus } from "./ui/Sidebar";
import "./AppSidebar.css";

export type Section = "all" | "ev-charger" | "heat-pump" | "faults" | "map";

const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: "all", label: "All resources" },
  { id: "ev-charger", label: "EV chargers" },
  { id: "heat-pump", label: "Heat pumps" },
  { id: "faults", label: "Faults" },
  { id: "map", label: "Map" },
];

const STATUS_COPY: Record<ConnectionStatus["kind"], { title: string; detail: string }> = {
  live: { title: "Connected · Sandbox", detail: "MQTT over WebSocket" },
  connecting: { title: "Connecting · Sandbox", detail: "Opening the broker socket…" },
  reconnecting: { title: "Reconnecting · Sandbox", detail: "Link dropped — mqtt.js is retrying" },
  disconnected: { title: "Disconnected · Sandbox", detail: "Showing last known state" },
};

interface Props {
  active: Section;
  onSelect: (section: Section) => void;
  counts: Partial<Record<Section, number>>;
  status: ConnectionStatus;
  customer: string;
  theme: Theme;
  onToggleTheme: () => void;
}

export function AppSidebar({ active, onSelect, counts, status, customer, theme, onToggleTheme }: Props) {
  const copy = STATUS_COPY[status.kind];
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-brand">
        <span className="app-sidebar-mark" aria-hidden="true" />
        <div className="app-sidebar-brand-text">
          <p className="app-sidebar-name">DER Monitor</p>
          <p className="app-sidebar-customer">{customer}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Light theme" : "Dark theme"}
          icon={theme === "dark" ? <Sun /> : <Moon />}
          onClick={onToggleTheme}
        />
      </div>

      <nav className="app-sidebar-nav" aria-label="Sections">
        <p className="app-sidebar-group">Resources</p>
        {NAV_ITEMS.map((item) => (
          <SidebarMenuButton
            key={item.id}
            label={item.label}
            badge={counts[item.id]}
            isActive={item.id === active}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </nav>

      <SidebarStatus connected={status.kind === "live"} title={copy.title} host={status.detail} detail={copy.detail} />
    </aside>
  );
}
