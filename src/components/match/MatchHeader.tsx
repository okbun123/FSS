import { getMatchPhaseLabel } from "../../domain/matchEvents";
import type { Match } from "../../domain/types";
import { TeamNameLink } from "../TeamNameLink";

interface MatchHeaderProps {
  match: Match;
  homeClubId: string;
  homeName: string;
  awayClubId: string;
  awayName: string;
  competitionName: string;
  matchDate: string;
  onOpenTeam: (clubId: string) => void;
}

export function MatchHeader({
  match,
  homeClubId,
  homeName,
  awayClubId,
  awayName,
  competitionName,
  matchDate,
  onOpenTeam,
}: MatchHeaderProps) {
  const phaseLabel = getMatchPhaseLabel(match.state.phase);

  return (
    <section className="match-header" aria-label="경기 스코어보드">
      <div className="match-broadcast-meta">
        <strong>{competitionName}</strong>
        <span>{matchDate}</span>
      </div>

      <div className="match-team-name match-team-home">
        <span>홈</span>
        <strong>
          <TeamNameLink clubId={homeClubId} onOpenTeam={onOpenTeam}>
            {homeName}
          </TeamNameLink>
        </strong>
      </div>

      <div
        className="match-score"
        aria-label={`${homeName} ${match.state.homeGoals}, ${awayName} ${match.state.awayGoals}, ${match.state.minute}분, ${phaseLabel}`}
      >
        <span className="match-minute">{match.state.minute}'</span>
        <strong>{match.state.homeGoals}</strong>
        <span>-</span>
        <strong>{match.state.awayGoals}</strong>
        <span className="match-phase">{phaseLabel}</span>
      </div>

      <div className="match-team-name match-team-away">
        <span>원정</span>
        <strong>
          <TeamNameLink clubId={awayClubId} onOpenTeam={onOpenTeam}>
            {awayName}
          </TeamNameLink>
        </strong>
      </div>

      <div className="match-broadcast-state">
        <strong>{match.state.isPaused ? "일시정지" : "진행"}</strong>
        <span>{phaseLabel}</span>
      </div>
    </section>
  );
}
