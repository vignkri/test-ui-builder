import type { FeedEntry } from "../types";
import { formatAgo } from "../mqtt/derive";
import "./EventFeed.css";

export function EventFeed({ feed, now, live }: { feed: FeedEntry[]; now: number; live: boolean }) {
  return (
    <div className="event-feed">
      <div className="event-feed-head">
        <p className="event-feed-title">Event feed</p>
        <span className={`event-feed-tag ${live ? "" : "event-feed-tag-off"}`}>{live ? "live" : "offline"}</span>
      </div>
      <div className="event-feed-list">
        {feed.length === 0 && (
          <p className="event-feed-empty">{live ? "Waiting for the first message…" : "No messages received."}</p>
        )}
        {feed.map((event) => (
          <div key={event.id} className="event-feed-row">
            <span className={`event-feed-dot event-feed-dot-${event.health}`} />
            <div className="event-feed-body">
              <p className="event-feed-resource">{event.resourceId}</p>
              <p className="mono event-feed-payload">
                v1/{event.channel} {event.summary}
              </p>
            </div>
            <span className="event-feed-time">{formatAgo(event.at, now)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
