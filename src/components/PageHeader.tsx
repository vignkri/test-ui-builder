import { Download, Zap } from "lucide-react";
import type { Zone } from "../mqtt/topics";
import { Button } from "./ui/Button";
import { ToggleGroup } from "./ui/Inputs";
import "./PageHeader.css";

export type ZoneFilter = "all" | Zone;

const ZONE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "DK1", label: "DK1" },
  { value: "DK2", label: "DK2" },
] as const;

interface Props {
  title: string;
  subtitle: string;
  zone: ZoneFilter;
  onZoneChange: (zone: ZoneFilter) => void;
}

export function PageHeader({ title, subtitle, zone, onZoneChange }: Props) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <div className="page-header-actions">
        <ToggleGroup label="Price zone" value={zone} options={ZONE_OPTIONS} onChange={onZoneChange} />
        <Button variant="outline" size="default" icon={<Download />}>
          Export CSV
        </Button>
        <Button size="default" icon={<Zap />}>
          Bulk activation
        </Button>
      </div>
    </div>
  );
}
