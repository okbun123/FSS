import { getMatchEventTypeLabel } from "../../domain/matchEvents";
import type { MatchEvent } from "../../domain/types";

function eventScore(event: MatchEvent): string {
  if (event.scoreAfter) {
    return `${event.scoreAfter.homeGoals}-${event.scoreAfter.awayGoals}`;
  }

  if (event.shootoutScoreAfter) {
    return `PK ${event.shootoutScoreAfter.homeGoals}-${event.shootoutScoreAfter.awayGoals}`;
  }

  return "";
}

export function MatchTimeline({ events }: { events: MatchEvent[] }) {
  return (
    <section className="data-panel match-timeline-panel">
      <h2>경기 로그</h2>
      {events.length === 0 ? (
        <p className="empty-note">아직 표시할 이벤트가 없습니다.</p>
      ) : (
        <ol className="match-timeline">
          {[...events].reverse().map((event) => (
            <li key={event.id}>
              <span>{event.minute}분</span>
              <strong>{getMatchEventTypeLabel(event.type)}</strong>
              <p>{event.description}</p>
              <small>{eventScore(event)}</small>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
