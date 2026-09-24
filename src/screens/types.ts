import type { FleetSnapshot } from "../mqtt/store";
import type { Screen } from "../routes";

/** Everything a screen needs; the snapshot is already filtered to the selected price zone. */
export interface ScreenProps {
  snapshot: FleetSnapshot;
  now: number;
  live: boolean;
  isMobile: boolean;
  selectedId: string | null;
  navigate: (screen: Screen, id?: string | null) => void;
}
