import "./TopHeader.css";

const NAV_ITEMS = ["Fleet", "Activations", "Telemetry", "Schedules"] as const;

export function TopHeader() {
  return (
    <header className="top-header">
      <div className="brand">
        <span className="brand-name">Weavemancer</span>
        <span className="brand-sub">Grid Flexibility</span>
      </div>
      <nav className="top-nav">
        {NAV_ITEMS.map((item, i) => (
          <span key={item} className={`top-nav-item ${i === 0 ? "top-nav-item-active" : ""}`}>
            {item}
          </span>
        ))}
      </nav>
      <div className="top-header-spacer" />
      <div className="env-status">
        <span className="env-dot" />
        <span>Sandbox · aggregator.gridhub.dev:8883</span>
      </div>
    </header>
  );
}
