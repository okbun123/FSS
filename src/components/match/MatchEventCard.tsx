import { getMatchEventTypeLabel } from "../../domain/matchEvents";
import type { MatchEvent } from "../../domain/types";

function scoreText(event: MatchEvent): string {
  if (event.scoreAfter) {
    return `${event.scoreAfter.homeGoals}-${event.scoreAfter.awayGoals}`;
  }

  if (event.shootoutScoreAfter) {
    return `승부차기 ${event.shootoutScoreAfter.homeGoals}-${event.shootoutScoreAfter.awayGoals}`;
  }

  return "-";
}

export function MatchEventCard({ event }: { event?: MatchEvent }) {
  if (!event) {
    return (
      <section className="match-event-card idle" role="status">
        <div className="event-minute">-</div>
        <div>
          <strong>현재 이벤트 없음</strong>
          <p>경기를 진행하면 주요 장면이 여기에 표시됩니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="match-event-card" role="status">
      <div className="event-minute">{event.minute}분</div>
      <div>
        <strong>{getMatchEventTypeLabel(event.type)}</strong>
        <p>{event.description}</p>
      </div>
      <dl>
        <div>
          <dt>팀</dt>
          <dd>{event.teamName ?? event.clubId ?? "-"}</dd>
        </div>
        <div>
          <dt>선수</dt>
          <dd>{event.playerName ?? "-"}</dd>
        </div>
        <div>
          <dt>스코어</dt>
          <dd>{scoreText(event)}</dd>
        </div>
      </dl>
    </section>
  );
}
