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
  return (
    <section className="match-header">
      <div className="match-meta">
        <span>{competitionName}</span>
        <span>{matchDate}</span>
        <span>{getMatchPhaseLabel(match.state.phase)}</span>
      </div>
      <div className="match-scoreboard" aria-label={`${homeName} ${match.state.homeGoals}, ${awayName} ${match.state.awayGoals}`}>
        <div className="match-team-name">
          <TeamNameLink clubId={homeClubId} onOpenTeam={onOpenTeam}>
            {homeName}
          </TeamNameLink>
        </div>
        <div className="match-score">
          <strong>{match.state.homeGoals}</strong>
          <span>-</span>
          <strong>{match.state.awayGoals}</strong>
        </div>
        <div className="match-team-name">
          <TeamNameLink clubId={awayClubId} onOpenTeam={onOpenTeam}>
            {awayName}
          </TeamNameLink>
        </div>
      </div>
      <div className="match-clock">
        <span>{match.state.minute}분</span>
        <span>{match.state.isPaused ? "일시 정지" : "진행 가능"}</span>
      </div>
    </section>
  );
}
