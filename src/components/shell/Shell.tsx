import type { ReactNode } from "react";
import { BookOpen, Copy, Moon, RefreshCw, Sun, WifiOff } from "lucide-react";
import type { ConnectionStatus } from "../../types";
import { formatClock } from "../../mqtt/derive";
import { QUICKSTART_URL, SANDBOX_HOST, zoneLabel, type ZoneFilter } from "./zone";
import { SCREENS, SCREEN_LABEL, href, type Screen } from "../../routes";
import type { Theme } from "../../theme";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Feedback";
import { ToggleGroup } from "../ui/Inputs";
import { SidebarMenuButton, SidebarStatus } from "../ui/Sidebar";
import "./Shell.css";

const STATUS_TITLE: Record<ConnectionStatus["kind"], string> = {
  live: "Connected · Sandbox",
  connecting: "Connecting · Sandbox",
  reconnecting: "Disconnected · Sandbox",
  disconnected: "Disconnected · Sandbox",
};

function statusDetail(s: ConnectionStatus): string {
  switch (s.kind) {
    case "live":
      return "MQTT over WebSocket · clean session";
    case "connecting":
      return "Opening the broker socket…";
    case "reconnecting":
      return `Retrying since ${formatClock(s.since)}`;
    default:
      return "Showing last known state";
  }
}

export function AppSidebar({
  active,
  counts,
  status,
  theme,
  onToggleTheme,
}: {
  active: Screen;
  counts: Partial<Record<Screen, number>>;
  status: ConnectionStatus;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  return (
    <aside className="app-sidebar">
      <div className="app-brand">
        <span className="app-brand-mark" aria-hidden="true">
          <span />
          <span />
        </span>
        <div className="app-brand-text">
          <p className="app-brand-name">gridhub</p>
          <p className="app-brand-sub">DER console · v2</p>
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
      <nav className="app-nav" aria-label="Monitor">
        <p className="app-nav-group">Monitor</p>
        {SCREENS.map((s) => (
          <SidebarMenuButton
            key={s}
            label={SCREEN_LABEL[s]}
            badge={counts[s]}
            isActive={s === active}
            onClick={() => (window.location.hash = href(s))}
          />
        ))}
      </nav>
      <SidebarStatus connected={status.kind === "live"} title={STATUS_TITLE[status.kind]} host={status.detail} detail={statusDetail(status)} />
    </aside>
  );
}

const MOBILE_SCREENS: Screen[] = ["overview", "resources", "activations", "events"];

export function MobileNav({ active }: { active: Screen }) {
  return (
    <nav className="mobile-nav" aria-label="Monitor">
      {MOBILE_SCREENS.map((s) => (
        <a key={s} href={href(s)} className={`mobile-nav-item ${s === active ? "mobile-nav-item-active" : ""}`}>
          <span className="mobile-nav-dot" aria-hidden="true" />
          {SCREEN_LABEL[s]}
        </a>
      ))}
    </nav>
  );
}

const ZONE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "DK1", label: "DK1" },
  { value: "DK2", label: "DK2" },
] as const;

export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  zone,
  onZoneChange,
  actions,
}: {
  breadcrumb: string;
  title: string;
  subtitle: string;
  zone: ZoneFilter;
  onZoneChange: (zone: ZoneFilter) => void;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <p className="page-breadcrumb">{breadcrumb}</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <div className="page-header-actions">
        <ToggleGroup label="Price zone" value={zone} options={ZONE_OPTIONS} onChange={onZoneChange} />
        {actions}
      </div>
    </header>
  );
}

/** 08b — the console never invents resource states; it greys what it last knew. */
export function ConnectionAlert({ status, onRetry }: { status: ConnectionStatus; onRetry: () => void }) {
  if (status.kind === "live") return null;
  if (status.kind === "connecting") {
    return <Alert variant="secondary" icon={<RefreshCw />} title="Connecting to the broker" description={status.detail} />;
  }
  const title =
    status.kind === "reconnecting" ? `Broker connection lost at ${formatClock(status.since)}` : "Not connected to the broker";
  return (
    <Alert
      variant="destructive"
      icon={<WifiOff />}
      title={title}
      description={
        status.kind === "reconnecting"
          ? "Showing last known values, greyed. The console doesn't invent resource states — each resource's own Last Will arrives once the link returns."
          : status.detail
      }
      action={
        status.kind === "reconnecting" ? (
          <Button variant="outline" onClick={onRetry}>
            Retry now
          </Button>
        ) : undefined
      }
    />
  );
}

/** 08d — connected, but nothing has registered on the namespace yet. */
export function EmptyNamespace({ zone, customer }: { zone: ZoneFilter; customer: string }) {
  const steps = [
    { title: "Connect over MQTTS with a Last Will", detail: `${SANDBOX_HOST} · will on v2/events/{resourceId}` },
    { title: "Publish the registration array", detail: `${zone === "all" ? "{priceZone}" : zone}/${customer}/v2/register` },
    { title: "Stream one metric per message", detail: "v2/measurements/{resourceId} · QoS 0" },
  ];
  return (
    <div className="empty-namespace">
      <div className="empty-card">
        <span className="empty-art" aria-hidden="true">
          <span />
          <span />
        </span>
        <h2 className="empty-title">
          No resources on {zoneLabel(zone)} / {customer} yet
        </h2>
        <p className="empty-text">
          Resources appear here the moment they publish to v2/register. One API covers every type — EV chargers, heat
          pumps, batteries, CHP, P2X, PV and other equipment.
        </p>
        <ol className="empty-steps">
          {steps.map((s, i) => (
            <li key={s.title} className="empty-step">
              <span className="empty-step-n">{i + 1}</span>
              <span>
                <span className="empty-step-title">{s.title}</span>
                <span className="empty-step-detail">{s.detail}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="empty-actions">
          <Button variant="outline" icon={<Copy />} onClick={() => void navigator.clipboard?.writeText(SANDBOX_HOST)}>
            Copy sandbox host
          </Button>
          <a className="button button-default button-size-sm" href={QUICKSTART_URL} target="_blank" rel="noreferrer">
            <BookOpen />
            Open DER Quickstart
          </a>
        </div>
      </div>
    </div>
  );
}
