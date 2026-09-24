export const ZONES = ["DK1", "DK2"] as const;
export type Zone = (typeof ZONES)[number];

export const CHANNELS = ["register", "update", "measurements", "events", "activation", "acknowledgement"] as const;
export type Channel = (typeof CHANNELS)[number];

export type ParsedTopic =
  | { version: "v2"; zone: Zone; customer: string; channel: Channel; resourceId: string | null }
  /** Deprecated v1 traffic: only noted so the Registration screen can list resources still to migrate. */
  | { version: "v1"; zone: Zone; customer: string; channel: string; resourceId: string | null };

function isZone(value: string): value is Zone {
  return (ZONES as readonly string[]).includes(value);
}

function isChannel(value: string): value is Channel {
  return (CHANNELS as readonly string[]).includes(value);
}

/**
 * v2: {priceZone}/{customerName}/v2/{channel}/{resourceId} — register has no resourceId segment.
 * v1 topics are recognised by prefix only; their payloads are not interpreted.
 */
export function parseTopic(topic: string): ParsedTopic | null {
  const parts = topic.split("/");
  if (parts.length < 4) return null;
  const [zone, customer, version, channel, resourceId] = parts;
  if (!isZone(zone) || !customer) return null;

  if (version === "v1") {
    return { version, zone, customer, channel: parts.slice(3).join("/"), resourceId: parts.length === 5 ? resourceId : null };
  }
  if (version !== "v2" || parts.length > 5 || !isChannel(channel)) return null;
  if (channel === "register") return parts.length === 4 ? { version, zone, customer, channel, resourceId: null } : null;
  if (!resourceId) return null;
  return { version, zone, customer, channel, resourceId };
}

export function buildTopic(zone: Zone, customer: string, channel: Channel, resourceId?: string): string {
  const base = `${zone}/${customer}/v2/${channel}`;
  return resourceId ? `${base}/${resourceId}` : base;
}

/** v2 is the data source; v1 is watched only to report resources that have not migrated yet. */
export function wildcardTopics(zone: Zone, customer: string): string[] {
  return [`${zone}/${customer}/v2/#`, `${zone}/${customer}/v1/#`];
}
