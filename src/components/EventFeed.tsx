import { EVENT_FEED } from "../data/resources";
import "./EventFeed.css";

export function EventFeed() {
  return (
    <div className="event-feed">
      <div className="event-feed-head">
        <p className="event-feed-title">Event feed</p>
        <span className="event-feed-tag">MQTT live</span>
      </div>
      <div className="event-feed-list">
        {EVENT_FEED.map((event) => (
          <div key={event.id} className="event-feed-row">
            <span className={`event-feed-dot event-feed-dot-${event.status}`} />
            <div className="event-feed-body">
              <p className="event-feed-resource">{event.resourceId}</p>
              <p className="mono event-feed-payload">
                {event.topic} {event.payload}
              </p>
            </div>
            <span className="event-feed-time">{event.at}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
