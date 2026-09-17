import "./Header.css";

interface Props {
  count: number;
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}

export function Header({
  count,
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
}: Props) {
  return (
    <header className="app-header">
      <div>
        <p className="app-title">Live fleet map</p>
        <p className="app-subtitle">{count} resources</p>
      </div>
      <div className="header-controls">
        <input
          className="search-input"
          type="search"
          placeholder="Search by ID or site"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <select value={typeFilter} onChange={(e) => onTypeFilterChange(e.target.value)}>
          <option value="all">All types</option>
          <option value="ev-charger">EV charger</option>
          <option value="heat-pump">Heat pump</option>
        </select>
        <select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="ok">OK</option>
          <option value="needs-attention">Needs attention</option>
          <option value="fault">Fault</option>
          <option value="offline">Offline</option>
        </select>
      </div>
    </header>
  );
}
