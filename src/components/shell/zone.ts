import type { Zone } from "../../mqtt/topics";

export const SANDBOX_HOST = "aggregator.gridhub.dev:8883";
export const QUICKSTART_URL = "https://connect.gridhub.ai/distributed-resources/quickstart";

/** Both price zones are subscribed; the header toggle narrows every screen to one. */
export type ZoneFilter = "all" | Zone;

export function zoneLabel(zone: ZoneFilter): string {
  return zone === "all" ? "DK1+DK2" : zone;
}
