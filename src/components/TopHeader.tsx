import "./TopHeader.css";

export function TopHeader() {
  return (
    <header className="top-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">Weavemancer</span>
      </div>
      <div className="top-header-spacer" />
      <span className="env-badge">Sandbox · MQTT live</span>
      <span className="org-name">acme-flex</span>
    </header>
  );
}
