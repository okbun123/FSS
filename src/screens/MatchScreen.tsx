import { useState } from "react";
import { BenchPanel } from "../components/match/BenchPanel";
import { LineupPanel } from "../components/match/LineupPanel";
import { MatchControls } from "../components/match/MatchControls";
import { MatchEventCard } from "../components/match/MatchEventCard";
import { MatchHeader } from "../components/match/MatchHeader";
import { MatchTimeline } from "../components/match/MatchTimeline";
import { PenaltyShootoutPanel } from "../components/match/PenaltyShootoutPanel";
import { ScreenShell } from "../components/ScreenShell";
import { TeamDetailModal } from "../components/TeamDetailModal";
import { TeamNameLink } from "../components/TeamNameLink";
import { getPausedMatchEvent } from "../domain/matchEvents";
import { getVisibleMatchLogEvents } from "../domain/matchLog";
import type { MatchAction } from "../domain/matchStateMachine";
import type { CareerState } from "../domain/types";

interface MatchScreenProps {
  career: CareerState;
  savedAtLabel: string | null;
  saveError: string | null;
  saveMessage: string | null;
  actionError: string | null;
  actionMessage: string | null;
  onMatchAction: (action: MatchAction) => void;
  onDeleteSave: () => void;
  onSaveCareer: () => void;
}

function formatDate(dateIso: string): string {
  const date = new Date(dateIso);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

export function MatchScreen({
  career,
  savedAtLabel,
  saveError,
  saveMessage,
  actionError,
  actionMessage,
  onMatchAction,
  onDeleteSave,
  onSaveCareer,
}: MatchScreenProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const match = career.activeMatchId ? career.matches[career.activeMatchId] : undefined;
  const fixture = career.fixtures.find(
    (candidate) => candidate.matchId === career.activeMatchId || candidate.id === match?.fixtureId,
  );

  if (!match) {
    return (
      <ScreenShell eyebrow="경기" title="경기 준비 중" wide>
        <section className="data-panel">
          <p className="empty-note">진행 중인 경기 정보를 찾을 수 없습니다.</p>
        </section>
      </ScreenShell>
    );
  }

  const homeName = career.clubs[match.homeClubId]?.name ?? match.homeClubId;
  const awayName = career.clubs[match.awayClubId]?.name ?? match.awayClubId;
  const competitionName = career.competitions[match.competitionId]?.name ?? match.competitionId;
  const pausedEvent = getPausedMatchEvent(match);
  const visibleEvents = getVisibleMatchLogEvents(match.events, career.player.id);

  return (
    <ScreenShell
      eyebrow={`${formatDate(career.currentDate)} 주간 경기`}
      title="경기"
      actions={
        <>
          <button className="primary-button" type="button" onClick={onSaveCareer}>
            저장
          </button>
          <button className="danger-button" type="button" onClick={onDeleteSave}>
            저장 삭제
          </button>
        </>
      }
      wide
    >
      <div className="career-dashboard match-screen">
        {saveError ? <div className="save-alert" role="alert">{saveError}</div> : null}
        {saveMessage ? <div className="save-status" role="status">{saveMessage}</div> : null}
        {actionError ? <div className="save-alert" role="alert">{actionError}</div> : null}
        {actionMessage ? <div className="save-status" role="status">{actionMessage}</div> : null}

        <MatchHeader
          match={match}
          homeClubId={match.homeClubId}
          homeName={homeName}
          awayClubId={match.awayClubId}
          awayName={awayName}
          competitionName={competitionName}
          matchDate={formatDate(fixture?.date ?? match.date)}
          onOpenTeam={setSelectedTeamId}
        />

        <div className="match-fixed-grid">
          <div className="match-team-column">
            <LineupPanel
              title={
                <>
                  <TeamNameLink clubId={match.homeClubId} onOpenTeam={setSelectedTeamId}>
                    {homeName}
                  </TeamNameLink>{" "}
                  선발
                </>
              }
              lineup={match.lineups.home}
            />
            <BenchPanel
              title={
                <>
                  <TeamNameLink clubId={match.homeClubId} onOpenTeam={setSelectedTeamId}>
                    {homeName}
                  </TeamNameLink>{" "}
                  벤치
                </>
              }
              lineup={match.lineups.home}
            />
          </div>

          <div className="match-center-column">
            <MatchEventCard event={pausedEvent} />
            <MatchControls match={match} onAction={onMatchAction} />
            <PenaltyShootoutPanel match={match} />
            <MatchTimeline events={visibleEvents} />
            <p className="saved-at">최근 저장: {savedAtLabel ?? "아직 없음"}</p>
          </div>

          <div className="match-team-column">
            <LineupPanel
              title={
                <>
                  <TeamNameLink clubId={match.awayClubId} onOpenTeam={setSelectedTeamId}>
                    {awayName}
                  </TeamNameLink>{" "}
                  선발
                </>
              }
              lineup={match.lineups.away}
            />
            <BenchPanel
              title={
                <>
                  <TeamNameLink clubId={match.awayClubId} onOpenTeam={setSelectedTeamId}>
                    {awayName}
                  </TeamNameLink>{" "}
                  벤치
                </>
              }
              lineup={match.lineups.away}
            />
          </div>
        </div>

        {selectedTeamId ? (
          <TeamDetailModal
            career={career}
            clubId={selectedTeamId}
            onClose={() => setSelectedTeamId(null)}
            onOpenTeam={setSelectedTeamId}
          />
        ) : null}
      </div>
    </ScreenShell>
  );
}
