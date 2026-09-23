import type { FeedEntry } from "../types";
import { feedTone, formatAgo, formatClock } from "../mqtt/derive";
import { FreshnessBadge } from "./ui/Badge";
import { Card } from "./ui/Card";
import { TimelineItem } from "./ui/DataDisplay";
import "./EventFeed.css";

export function EventFeed({ feed, now, live }: { feed: FeedEntry[]; now: number; live: boolean }) {
  return (
    <Card
      className="event-feed"
      title="Event feed"
      description="Every MQTT message, newest first."
      action={<FreshnessBadge freshness={live ? "live" : "lastKnown"} />}
    >
      <div className="event-feed-list">
        {feed.length === 0 && (
          <p className="event-feed-empty">{live ? "Waiting for the first message…" : "No messages received."}</p>
        )}
        {feed.map((event, i) => (
          <TimelineItem
            key={event.id}
            status={feedTone(event)}
            title={<span className="event-feed-resource">{event.resourceId}</span>}
            time={`${formatClock(event.at)} · ${formatAgo(event.at, now)}`}
            description={
              <>
                <span className="mono">v1/{event.channel}</span> {event.summary}
              </>
            }
            showConnector={i < feed.length - 1}
          />
        ))}
      </div>
    </Card>
  );
}
