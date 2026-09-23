import "./Sidebar.css";

/** shadcn/ui SidebarMenuButton with an optional SidebarMenuBadge count. */
export function SidebarMenuButton({
  label,
  badge,
  isActive,
  onClick,
}: {
  label: string;
  badge?: number | string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`sidebar-menu-button ${isActive ? "sidebar-menu-button-active" : ""}`}
      aria-current={isActive ? "page" : undefined}
      onClick={onClick}
    >
      <span className="sidebar-menu-icon" aria-hidden="true" />
      <span className="sidebar-menu-label">{label}</span>
      {badge !== undefined && <span className="sidebar-menu-badge">{badge}</span>}
    </button>
  );
}

/** DER SidebarStatus — the MQTT broker link. */
export function SidebarStatus({
  connected,
  title,
  host,
  detail,
}: {
  connected: boolean;
  title: string;
  host: string;
  detail: string;
}) {
  return (
    <div className={`sidebar-status ${connected ? "sidebar-status-connected" : "sidebar-status-disconnected"}`}>
      <div className="sidebar-status-header">
        <span className="sidebar-status-indicator" aria-hidden="true" />
        <p className="sidebar-status-title">{title}</p>
      </div>
      <p className="sidebar-status-host">{host}</p>
      <p className="sidebar-status-detail">{detail}</p>
    </div>
  );
}
