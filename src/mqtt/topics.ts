export const ZONES = ["DK1", "DK2"] as const;
export type Zone = (typeof ZONES)[number];

export const CHANNELS = [
  "register",
  "power",
  "status",
  "activation",
  "acknowledgement",
  "update",
  "measurement",
  "event",
  "schedules",
] as const;
export type Channel = (typeof CHANNELS)[number];

export interface ParsedTopic {
  zone: Zone;
  customer: string;
  channel: Channel;
  bulk: boolean;
  resourceId: string | null;
}

function isZone(value: string): value is Zone {
  return (ZONES as readonly string[]).includes(value);
}

function isChannel(value: string): value is Channel {
  return (CHANNELS as readonly string[]).includes(value);
}

/**
 * Spec: {priceZone}/{customerName}/v1/{channel}/{resourceId}
 * Bulk variants: {priceZone}/{customerName}/v1/bulk/{channel}
 * Register has no resourceId segment; the id lives in the payload.
 * Zonal schedules: {priceZone}/{customerName}/v1/schedules/zonal
 */
export function parseTopic(topic: string): ParsedTopic | null {
  const parts = topic.split("/");
  if (parts.length < 4 || parts.length > 5) return null;
  const [zone, customer, version, seg3, seg4] = parts;
  if (!isZone(zone) || version !== "v1" || !customer) return null;

  if (seg3 === "bulk") {
    if (!seg4 || !isChannel(seg4)) return null;
    return { zone, customer, channel: seg4, bulk: true, resourceId: null };
  }

  if (!isChannel(seg3)) return null;
  if (seg3 === "schedules") {
    return seg4 === "zonal" ? { zone, customer, channel: seg3, bulk: false, resourceId: null } : null;
  }
  return { zone, customer, channel: seg3, bulk: false, resourceId: seg4 ?? null };
}

export function buildTopic(zone: Zone, customer: string, channel: Channel, resourceId?: string): string {
  const base = `${zone}/${customer}/v1/${channel}`;
  return resourceId ? `${base}/${resourceId}` : base;
}

export function buildBulkTopic(zone: Zone, customer: string, channel: Channel): string {
  return `${zone}/${customer}/v1/bulk/${channel}`;
}

export function wildcardTopic(zone: Zone, customer: string): string {
  return `${zone}/${customer}/v1/#`;
}
