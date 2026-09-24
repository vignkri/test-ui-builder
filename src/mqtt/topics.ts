export const ZONES = ["DK1", "DK2"] as const;
export type Zone = (typeof ZONES)[number];

export type ApiVersion = "v1" | "v2";

export const CHANNELS = ["register", "update", "measurements", "events", "activation", "acknowledgement"] as const;
export type Channel = (typeof CHANNELS)[number];

/** The deprecated v1 EV charger and heat pump channels — still published and operational. */
export const V1_CHANNELS = [
  "register",
  "update",
  "power",
  "status",
  "measurement",
  "event",
  "activation",
  "acknowledgement",
  "schedules",
] as const;
export type V1Channel = (typeof V1_CHANNELS)[number];

export type ParsedTopic =
  | { version: "v2"; zone: Zone; customer: string; channel: Channel; resourceId: string | null }
  | { version: "v1"; zone: Zone; customer: string; channel: V1Channel; resourceId: string | null; bulk: boolean };

function isZone(value: string): value is Zone {
  return (ZONES as readonly string[]).includes(value);
}

function oneOf<T extends string>(values: readonly T[], v: string | undefined): v is T {
  return v !== undefined && (values as readonly string[]).includes(v);
}

/**
 * v2: {priceZone}/{customerName}/v2/{channel}/{resourceId} — register carries no resourceId segment.
 * v1: {priceZone}/{customerName}/v1/{channel}/{resourceId}, plus v1/bulk/{channel} and
 *     v1/schedules/zonal. Register has no resourceId segment; the id lives in the payload.
 */
export function parseTopic(topic: string): ParsedTopic | null {
  const parts = topic.split("/");
  if (parts.length < 4 || parts.length > 5) return null;
  const [zone, customer, version, seg3, seg4] = parts;
  if (!isZone(zone) || !customer) return null;

  if (version === "v1") {
    if (seg3 === "bulk") return oneOf(V1_CHANNELS, seg4) ? { version, zone, customer, channel: seg4, resourceId: null, bulk: true } : null;
    if (!oneOf(V1_CHANNELS, seg3)) return null;
    return { version, zone, customer, channel: seg3, resourceId: seg4 ?? null, bulk: false };
  }

  if (version !== "v2" || !oneOf(CHANNELS, seg3)) return null;
  if (seg3 === "register") return parts.length === 4 ? { version, zone, customer, channel: seg3, resourceId: null } : null;
  if (!seg4) return null;
  return { version, zone, customer, channel: seg3, resourceId: seg4 };
}

export function buildTopic(version: ApiVersion, zone: Zone, customer: string, channel: string, resourceId?: string): string {
  const base = `${zone}/${customer}/${version}/${channel}`;
  return resourceId ? `${base}/${resourceId}` : base;
}

/** Both versions are live: a resource is on v1 or v2 depending on which prefix it publishes to. */
export function wildcardTopics(zone: Zone, customer: string): string[] {
  return [`${zone}/${customer}/v2/#`, `${zone}/${customer}/v1/#`];
}
