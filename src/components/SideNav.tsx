import "./SideNav.css";

export type Section = "map" | "ev-charger" | "heat-pump" | "faults" | "registration";

const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: "map", label: "All resources" },
  { id: "ev-charger", label: "EV chargers" },
  { id: "heat-pump", label: "Heat pumps" },
  { id: "faults", label: "Faults" },
  { id: "registration", label: "Registration" },
];

interface Props {
  active: Section;
  onSelect: (section: Section) => void;
}

export function SideNav({ active, onSelect }: Props) {
  return (
    <nav className="side-nav">
      <p className="side-nav-label">Resources</p>
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`side-nav-item ${item.id === active ? "side-nav-item-active" : ""}`}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
