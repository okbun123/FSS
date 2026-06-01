import { type ReactNode, useMemo, useState } from "react";
import { AttributeTable } from "../components/career/AttributeTable";
import { MetricGrid, type MetricItem } from "../components/career/MetricGrid";
import { PlayoffBracketPanel } from "../components/career/PlayoffBracketPanel";
import { PromotionRelegationSummary } from "../components/career/PromotionRelegationSummary";
import { TransferNegotiationModal } from "../components/career/TransferNegotiationModal";
import { UnifiedFeedPanel } from "../components/career/UnifiedFeedPanel";
import { ScreenShell } from "../components/ScreenShell";
import { TeamDetailModal } from "../components/TeamDetailModal";
import { TeamNameLink } from "../components/TeamNameLink";
import { MatchScreen } from "./MatchScreen";
import { getClubName, getLeagueName } from "../data/fictionalLeagues";
import {
  getDominantFootLabel,
  getPotentialHint,
  PERSONALITY_LABELS,
  POSITION_LABELS,
  SQUAD_ROLE_LABELS,
} from "../domain/player";
import type {
  CareerHistoryEntry,
  CareerState,
  ClubEvolutionResult,
  Fixture,
  LeagueTableRow,
  LeagueTier,
  MatchPlayer,
  MonthlyEvent,
  PlayerAppearanceLog,
  RecentResult,
} from "../domain/types";
import {
  advanceWeek,
  getCurrentClub,
  getCurrentLeague,
  getCurrentWeekFixtures,
  getNextPlayerFixture,
  progressActiveMatch,
  startNextSeason,
} from "../game/monthlyCareer";
import { calculateOverall } from "../game/overall";
import type { MatchAction } from "../domain/matchStateMachine";
import type { TransferNegotiationAction } from "../domain/negotiation";
import {
  acceptTransferOffer,
  applyTransferNegotiationAction,
  holdTransferOffer,
  rejectTransferOffer,
} from "../domain/transfers";
import {
  formatInternalClubValueAsStars,
  formatStars,
  getPublicClubStars,
  getVisibleClubInfoItems,
} from "../domain/clubPublicInfo";
import { getDomesticCupRoundLabel, isDomesticCupFixture } from "../domain/domesticCup";

interface CareerDashboardScreenProps {
  career: CareerState;
  savedAtLabel: string | null;
  saveError: string | null;
  saveMessage: string | null;
  onCareerChange: (career: CareerState) => void;
  onDeleteSave: () => void;
  onSaveCareer: () => void;
}

type OpenTeamHandler = (clubId: string) => void;
type DataTableCell = ReactNode;
type DataTableRow = DataTableCell[];

export type DashboardTab = "main" | "player" | "club" | "career" | "league";
type ClubDashboardSection = "overview" | "schedule" | "squad";
type CareerDashboardSection = "season" | "logs" | "history";
type LeagueDashboardSection = "standings" | "fixtures" | "rules" | "cups";

export const CAREER_DASHBOARD_TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: "main", label: "메인" },
  { id: "player", label: "선수 상태" },
  { id: "club", label: "소속팀" },
  { id: "career", label: "커리어" },
  { id: "league", label: "리그" },
];

export const CLUB_DASHBOARD_SECTIONS: Array<{ id: ClubDashboardSection; label: string }> = [
  { id: "overview", label: "요약" },
  { id: "schedule", label: "일정" },
  { id: "squad", label: "스쿼드" },
];

export const CAREER_DASHBOARD_SECTIONS: Array<{ id: CareerDashboardSection; label: string }> = [
  { id: "season", label: "시즌 요약" },
  { id: "logs", label: "경기 기록" },
  { id: "history", label: "히스토리" },
];

export const LEAGUE_DASHBOARD_SECTIONS: Array<{ id: LeagueDashboardSection; label: string }> = [
  { id: "standings", label: "순위" },
  { id: "fixtures", label: "일정" },
  { id: "rules", label: "승강" },
  { id: "cups", label: "컵" },
];

const TABLE_PAGE_SIZE = 8;

function formatMonth(career: CareerState): string {
  if (career.season.isComplete) {
    return "시즌 종료";
  }

  return career.season.months.find((month) => month.month === career.season.currentMonth)?.label ?? `${career.season.currentMonth}월`;
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

function formatFixture(fixture?: Fixture): string {
  if (!fixture) {
    return "예정 경기 없음";
  }

  return `${getClubName(fixture.homeClubId)} vs ${getClubName(fixture.awayClubId)}`;
}

function resultText(fixture: Fixture): string {
  if (!fixture.result) {
    return "예정";
  }

  const score = `${fixture.result.homeGoals}-${fixture.result.awayGoals}`;

  if (fixture.result.decidedBy === "penalties") {
    return `${score} (승부차기 ${fixture.result.homePenaltyGoals ?? 0}-${fixture.result.awayPenaltyGoals ?? 0})`;
  }

  if (fixture.result.decidedBy === "extraTime") {
    return `${score} (연장)`;
  }

  return score;
}

function fixtureRoundText(fixture: Fixture): string | number {
  return isDomesticCupFixture(fixture) ? getDomesticCupRoundLabel(fixture.round) : fixture.round;
}

function formatClubStarTransition(oldValue: number, newValue: number): string {
  const previousStars = formatInternalClubValueAsStars(oldValue);
  const nextStars = formatInternalClubValueAsStars(newValue);

  return previousStars === nextStars ? nextStars : `${previousStars} -> ${nextStars}`;
}

function appearanceText(fixture: Fixture): string {
  if (!fixture.result?.playerAppeared) {
    return "미출전";
  }

  return `${fixture.result.playerMinutes ?? 0}분, 평점 ${(fixture.result.playerRating ?? 0).toFixed(1)}, ${fixture.result.playerGoals ?? 0}골 ${fixture.result.playerAssists ?? 0}도움`;
}

function outcomeText(outcome?: RecentResult["outcome"]): string {
  if (outcome === "win") {
    return "승";
  }

  if (outcome === "loss") {
    return "패";
  }

  return outcome === "draw" ? "무" : "-";
}

function getClubFixtures(career: CareerState): Fixture[] {
  const club = getCurrentClub(career);

  return career.season.fixtures.filter(
    (fixture) => fixture.homeClubId === club.id || fixture.awayClubId === club.id,
  );
}

function getFixtureOpponent(fixture: Fixture, clubId: string): string {
  return getClubName(fixture.homeClubId === clubId ? fixture.awayClubId : fixture.homeClubId);
}

function getFixtureOpponentId(fixture: Fixture, clubId: string): string {
  return fixture.homeClubId === clubId ? fixture.awayClubId : fixture.homeClubId;
}

function getFixtureVenue(fixture: Fixture, clubId: string): string {
  return fixture.homeClubId === clubId ? "홈" : "원정";
}

function getClubDisplayName(career: CareerState, clubId: string): string {
  return career.clubs[clubId]?.name ?? getClubName(clubId);
}

function getCompetitionDisplayName(career: CareerState, competitionId: string): string {
  return career.competitions[competitionId]?.name ?? competitionId;
}

function renderTeamName(
  career: CareerState,
  clubId: string,
  onOpenTeam: OpenTeamHandler,
  label = getClubDisplayName(career, clubId),
): ReactNode {
  return (
    <TeamNameLink clubId={clubId} onOpenTeam={onOpenTeam}>
      {label}
    </TeamNameLink>
  );
}

function formatFixtureLink(
  career: CareerState,
  fixture: Fixture | undefined,
  onOpenTeam: OpenTeamHandler,
): ReactNode {
  if (!fixture) {
    return "예정 경기 없음";
  }

  return (
    <>
      {renderTeamName(career, fixture.homeClubId, onOpenTeam)} vs{" "}
      {renderTeamName(career, fixture.awayClubId, onOpenTeam)}
    </>
  );
}

function getPlayerFromAppearance(career: CareerState, log: PlayerAppearanceLog): MatchPlayer | undefined {
  if (!log.matchId) {
    return undefined;
  }

  const match = career.matches[log.matchId];

  if (!match) {
    return undefined;
  }

  return [
    ...match.lineups.home.starters,
    ...match.lineups.home.substitutes,
    ...match.lineups.away.starters,
    ...match.lineups.away.substitutes,
  ].find((player) => player.playerId === career.player.id || player.isUserPlayer);
}

function disciplineText(player?: MatchPlayer): string {
  const yellows = player?.yellowCards ?? 0;
  const redCards = player?.redCard ? 1 : 0;

  if (yellows === 0 && redCards === 0) {
    return "-";
  }

  return `경고 ${yellows}, 퇴장 ${redCards}`;
}

function injuryText(player?: MatchPlayer): string {
  return player?.injured ? "부상" : "-";
}

function getLeagueZoneLabel(career: CareerState, leagueId: LeagueTier, row: LeagueTableRow): string {
  const league = career.leagues[leagueId];
  const totalClubs = career.season.tables[leagueId].length;
  const rules = league.ruleSet;

  if (rules.directPromotionSlots > 0 && row.position <= rules.directPromotionSlots) {
    return "승격";
  }

  if (
    rules.promotionPlayoffConfig?.entrantPositionStart &&
    rules.promotionPlayoffConfig.entrantPositionEnd &&
    row.position >= rules.promotionPlayoffConfig.entrantPositionStart &&
    row.position <= rules.promotionPlayoffConfig.entrantPositionEnd
  ) {
    return "승격 PO";
  }

  if (rules.directRelegationSlots > 0 && row.position > totalClubs - rules.directRelegationSlots) {
    return "강등";
  }

  if (
    rules.relegationPlayoffConfig?.entrantPositionsFromBottom?.some(
      (positionFromBottom) => row.position === totalClubs - positionFromBottom + 1,
    )
  ) {
    return "강등 PO";
  }

  return "-";
}

export function getCareerRecentResultRows(career: CareerState): Array<Array<string | number>> {
  return career.recentResults.slice(0, 12).map((result) => [
    formatDate(result.date),
    `${getClubName(result.homeClubId)} ${result.homeGoals}-${result.awayGoals} ${getClubName(result.awayClubId)}`,
    outcomeText(result.outcome),
    result.playerClubId ? getClubName(result.playerClubId) : "-",
  ]);
}

export function getCareerAppearanceRows(career: CareerState): Array<Array<string | number>> {
  return career.playerAppearanceLogs.slice().reverse().slice(0, 16).map((log) => {
    const player = getPlayerFromAppearance(career, log);

    return [
      formatDate(log.date),
      getCompetitionDisplayName(career, log.competitionId),
      getClubName(log.opponentClubId),
      log.wasHome ? "홈" : "원정",
      log.position,
      `${log.minutes}분`,
      log.rating.toFixed(1),
      log.goals,
      log.assists,
      disciplineText(player),
      injuryText(player),
    ];
  });
}

export function getClubFixtureRows(career: CareerState): Array<Array<string | number>> {
  const club = getCurrentClub(career);

  return getClubFixtures(career).slice(0, 160).map((fixture) => [
    fixtureRoundText(fixture),
    formatDate(fixture.date),
    career.competitions[fixture.competitionId]?.name ?? getLeagueName(fixture.leagueId),
    getFixtureVenue(fixture, club.id),
    getFixtureOpponent(fixture, club.id),
    fixture.status === "played" ? resultText(fixture) : "예정",
  ]);
}

export function getClubRecentResultRows(career: CareerState): Array<Array<string | number>> {
  const club = getCurrentClub(career);

  return getClubFixtures(career)
    .filter((fixture) => fixture.status === "played")
    .slice()
    .reverse()
    .slice(0, 12)
    .map((fixture) => [
      formatDate(fixture.date),
      getFixtureVenue(fixture, club.id),
      getFixtureOpponent(fixture, club.id),
      resultText(fixture),
      appearanceText(fixture),
    ]);
}

export function getLeagueStandingsRows(
  career: CareerState,
  leagueId: LeagueTier,
): Array<Array<string | number>> {
  return career.season.tables[leagueId].map((row) => [
    row.position,
    row.clubName,
    row.played,
    row.points,
    row.wins,
    row.draws,
    row.losses,
    row.goalDifference,
    getLeagueZoneLabel(career, leagueId, row),
  ]);
}

function getCareerRecentResultDisplayRows(
  career: CareerState,
  onOpenTeam: OpenTeamHandler,
): DataTableRow[] {
  return career.recentResults.slice(0, 12).map((result) => [
    formatDate(result.date),
    <>
      {renderTeamName(career, result.homeClubId, onOpenTeam)} {result.homeGoals}-{result.awayGoals}{" "}
      {renderTeamName(career, result.awayClubId, onOpenTeam)}
    </>,
    outcomeText(result.outcome),
    result.playerClubId ? renderTeamName(career, result.playerClubId, onOpenTeam) : "-",
  ]);
}

function getCareerAppearanceDisplayRows(
  career: CareerState,
  onOpenTeam: OpenTeamHandler,
): DataTableRow[] {
  return career.playerAppearanceLogs.slice().reverse().slice(0, 16).map((log) => {
    const player = getPlayerFromAppearance(career, log);

    return [
      formatDate(log.date),
      getCompetitionDisplayName(career, log.competitionId),
      renderTeamName(career, log.opponentClubId, onOpenTeam),
      log.wasHome ? "홈" : "원정",
      log.position,
      `${log.minutes}분`,
      log.rating.toFixed(1),
      log.goals,
      log.assists,
      disciplineText(player),
      injuryText(player),
    ];
  });
}

function getClubFixtureDisplayRows(
  career: CareerState,
  onOpenTeam: OpenTeamHandler,
): DataTableRow[] {
  const club = getCurrentClub(career);

  return getClubFixtures(career).slice(0, 160).map((fixture) => {
    const opponentClubId = getFixtureOpponentId(fixture, club.id);

    return [
      fixtureRoundText(fixture),
      formatDate(fixture.date),
      career.competitions[fixture.competitionId]?.name ?? getLeagueName(fixture.leagueId),
      getFixtureVenue(fixture, club.id),
      renderTeamName(career, opponentClubId, onOpenTeam),
      fixture.status === "played" ? resultText(fixture) : "예정",
    ];
  });
}

function getClubRecentResultDisplayRows(
  career: CareerState,
  onOpenTeam: OpenTeamHandler,
): DataTableRow[] {
  const club = getCurrentClub(career);

  return getClubFixtures(career)
    .filter((fixture) => fixture.status === "played")
    .slice()
    .reverse()
    .slice(0, 12)
    .map((fixture) => {
      const opponentClubId = getFixtureOpponentId(fixture, club.id);

      return [
        formatDate(fixture.date),
        getFixtureVenue(fixture, club.id),
        renderTeamName(career, opponentClubId, onOpenTeam),
        resultText(fixture),
        appearanceText(fixture),
      ];
    });
}

function getLeagueStandingsDisplayRows(
  career: CareerState,
  leagueId: LeagueTier,
  onOpenTeam: OpenTeamHandler,
): DataTableRow[] {
  return career.season.tables[leagueId].map((row) => [
    row.position,
    renderTeamName(career, row.clubId, onOpenTeam, row.clubName),
    row.played,
    row.points,
    row.wins,
    row.draws,
    row.losses,
    row.goalDifference,
    getLeagueZoneLabel(career, leagueId, row),
  ]);
}

function getMajorClubEvolutionRows(
  career: CareerState,
  onOpenTeam: OpenTeamHandler,
): DataTableRow[] {
  return Object.values(career.clubs)
    .map((club) => club.lastEvolution)
    .filter((evolution): evolution is ClubEvolutionResult =>
      Boolean(evolution && evolution.seasonNumber === career.season.number),
    )
    .map((evolution) => ({
      evolution,
      impact:
        Math.abs(evolution.newValues.reputation - evolution.oldValues.reputation) +
        Math.abs(evolution.newValues.squadStrength - evolution.oldValues.squadStrength) +
        Math.abs(evolution.newValues.budgetLevel - evolution.oldValues.budgetLevel),
    }))
    .filter(({ impact }) => impact >= 2)
    .sort((left, right) => right.impact - left.impact)
    .slice(0, 8)
    .map(({ evolution }) => {
      const club = career.clubs[evolution.clubId];

      return [
        renderTeamName(career, evolution.clubId, onOpenTeam, club?.shortName ?? club?.name ?? evolution.clubId),
        formatClubStarTransition(evolution.oldValues.reputation, evolution.newValues.reputation),
        formatClubStarTransition(evolution.oldValues.budgetLevel, evolution.newValues.budgetLevel),
        formatClubStarTransition(evolution.oldValues.squadStrength, evolution.newValues.squadStrength),
        formatClubStarTransition(evolution.oldValues.youthOpportunity, evolution.newValues.youthOpportunity),
        evolution.reasons[0] ?? "-",
      ];
    });
}

function DataTable({
  columns,
  rows,
  emptyMessage = "표시할 데이터가 없습니다.",
}: {
  columns: string[];
  rows: DataTableRow[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <p className="empty-note">{emptyMessage}</p>;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaginatedDataTable({
  columns,
  rows,
  emptyMessage,
  pageSize = TABLE_PAGE_SIZE,
}: {
  columns: string[];
  rows: DataTableRow[];
  emptyMessage?: string;
  pageSize?: number;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <div className="paginated-table">
      <DataTable columns={columns} rows={visibleRows} emptyMessage={emptyMessage} />
      {rows.length > pageSize ? (
        <div className="pagination-row table-pagination">
          <button
            className="secondary-button"
            type="button"
            onClick={() => setPage((currentPage) => Math.max(0, currentPage - 1))}
            disabled={safePage === 0}
          >
            이전
          </button>
          <span>
            {safePage + 1} / {pageCount}
          </span>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setPage((currentPage) => Math.min(pageCount - 1, currentPage + 1))}
            disabled={safePage >= pageCount - 1}
          >
            다음
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SectionTabs<T extends string>({
  tabs,
  activeTab,
  ariaLabel,
  onChange,
}: {
  tabs: Array<{ id: T; label: string }>;
  activeTab: T;
  ariaLabel: string;
  onChange: (tab: T) => void;
}) {
  return (
    <nav className="section-tab-bar" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          className={activeTab === tab.id ? "section-tab-button active" : "section-tab-button"}
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function EventPanel({
  event,
  selectedChoiceId,
  onSelectChoice,
}: {
  event?: MonthlyEvent;
  selectedChoiceId: string | null;
  onSelectChoice: (choiceId: string) => void;
}) {
  if (!event) {
    return (
      <section className="data-panel event-panel">
        <h2>월간 이벤트</h2>
        <p className="empty-note">이번 주에는 의사결정 이벤트가 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="data-panel event-panel">
      <h2>{event.title}</h2>
      <p>{event.description}</p>
      <div className="event-choice-grid">
        {event.choices.map((choice, index) => {
          const selected = selectedChoiceId ? selectedChoiceId === choice.id : index === 0;

          return (
            <button
              className={selected ? "event-choice selected" : "event-choice"}
              key={choice.id}
              type="button"
              onClick={() => onSelectChoice(choice.id)}
            >
              <strong>{choice.label}</strong>
              <span>{choice.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PanelList({
  items,
  emptyMessage,
}: {
  items: Array<{ id: string; title: ReactNode; description: ReactNode; className?: string }>;
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <p className="empty-note">{emptyMessage}</p>;
  }

  return (
    <ol className="simple-list">
      {items.map((item) => (
        <li className={item.className} key={item.id}>
          <strong>{item.title}</strong>
          <span>{item.description}</span>
        </li>
      ))}
    </ol>
  );
}

function MainTab({
  career,
  selectedChoiceId,
  onSelectChoice,
  onAdvanceWeek,
  onStartNextSeason,
  onNegotiateTransfer,
  onAcceptTransfer,
  onRejectTransfer,
  onHoldTransfer,
  onOpenTeam,
}: {
  career: CareerState;
  selectedChoiceId: string | null;
  onSelectChoice: (choiceId: string) => void;
  onAdvanceWeek: () => void;
  onStartNextSeason: () => void;
  onNegotiateTransfer: (offerId: string) => void;
  onAcceptTransfer: (offerId: string) => void;
  onRejectTransfer: (offerId: string) => void;
  onHoldTransfer: (offerId: string) => void;
  onOpenTeam: OpenTeamHandler;
}) {
  const currentClub = getCurrentClub(career);
  const nextFixture = getNextPlayerFixture(career);
  const currentWeekFixtures = getCurrentWeekFixtures(career);
  const recentGrowth = career.monthlyDevelopmentLog.at(-1)?.entries.slice(0, 6) ?? [];

  return (
    <div className="career-main-grid">
      <div className="career-primary-column">
        <section className="data-panel dashboard-summary">
          <div>
            <h2>{career.season.year} 시즌, {formatMonth(career)}</h2>
            <p>{renderTeamName(career, currentClub.id, onOpenTeam)} · {getLeagueName(currentClub.leagueId)}</p>
          </div>
          <MetricGrid
            items={[
              { label: "다음 경기", value: formatFixtureLink(career, nextFixture, onOpenTeam) },
              { label: "이번 주 경기", value: `${currentWeekFixtures.length}경기` },
              { label: "폼", value: career.player.form, tone: career.player.form >= 65 ? "good" : "default" },
              { label: "컨디션", value: career.player.condition, tone: career.player.condition >= 75 ? "good" : "default" },
              { label: "피로", value: career.player.fatigue, tone: career.player.fatigue >= 70 ? "warning" : "default" },
              { label: "감독 신뢰", value: career.player.coachTrust },
            ]}
          />
          <div className="quick-action-row">
            {career.season.isComplete ? (
              <button className="primary-button" type="button" onClick={onStartNextSeason}>
                다음 시즌 시작
              </button>
            ) : (
              <button className="primary-button" type="button" onClick={onAdvanceWeek}>
                다음 주로 진행
              </button>
            )}
          </div>
        </section>

        {career.season.isComplete ? (
          <section className="data-panel fixed-panel">
            <h2>시즌 결산</h2>
            <PaginatedDataTable
              columns={["구단", "평판", "예산", "전력", "유스", "주요 이유"]}
              rows={getMajorClubEvolutionRows(career, onOpenTeam)}
              emptyMessage="이번 시즌 큰 구단 변화는 없습니다."
              pageSize={5}
            />
          </section>
        ) : null}

        <EventPanel event={career.currentEvent} selectedChoiceId={selectedChoiceId} onSelectChoice={onSelectChoice} />

        <section className="data-panel compact-panel">
          <h2>최근 능력치 변화</h2>
          {recentGrowth.length === 0 ? (
            <p className="empty-note">아직 성장 리포트가 없습니다.</p>
          ) : (
            <dl className="growth-list">
              {recentGrowth.map((entry) => (
                <div key={entry.attribute}>
                  <dt>{entry.label}</dt>
                  <dd>+{entry.amount.toFixed(2)}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>

      <div className="career-side-column">
        <UnifiedFeedPanel
          career={career}
          onNegotiateTransfer={onNegotiateTransfer}
          onAcceptTransfer={onAcceptTransfer}
          onRejectTransfer={onRejectTransfer}
          onHoldTransfer={onHoldTransfer}
          onOpenTeam={onOpenTeam}
        />
      </div>
    </div>
  );
}

function PlayerTab({ career, onOpenTeam }: { career: CareerState; onOpenTeam: OpenTeamHandler }) {
  const club = getCurrentClub(career);
  const league = getCurrentLeague(career);
  const ovr = calculateOverall(career.player);
  const profileItems: MetricItem[] = [
    { label: "선수", value: career.player.name },
    { label: "나이", value: `${career.player.age}세` },
    { label: "국적", value: career.player.nationality },
    { label: "소속팀", value: renderTeamName(career, club.id, onOpenTeam) },
    { label: "리그", value: league.name },
    { label: "포지션", value: `${career.player.selectedPosition} · ${POSITION_LABELS[career.player.selectedPosition]}` },
    { label: "OVR", value: ovr, tone: ovr >= 70 ? "good" : "default" },
    { label: "잠재력", value: getPotentialHint(career.player.potential), tone: career.player.potential >= 88 ? "good" : "default" },
    { label: "주발", value: getDominantFootLabel(career.player) },
    { label: "왼발", value: career.player.leftFoot },
    { label: "오른발", value: career.player.rightFoot },
    { label: "성격", value: PERSONALITY_LABELS[career.player.personality] },
    { label: "폼", value: career.player.form },
    { label: "컨디션", value: career.player.condition },
    { label: "피로", value: career.player.fatigue, tone: career.player.fatigue >= 70 ? "warning" : "default" },
    { label: "평판", value: career.player.reputation },
    { label: "팬 지지", value: career.fanSupport },
    { label: "감독 신뢰", value: career.player.coachTrust },
    { label: "시장 가치", value: `${career.player.marketValue.toLocaleString("ko-KR")}만` },
    { label: "부상", value: career.injury.severity === "healthy" ? "건강" : career.injury.description ?? "관리 필요" },
  ];

  return (
    <div className="career-tab-grid player-tab-layout">
      <section className="data-panel player-profile-panel fixed-panel">
        <h2>선수 프로필</h2>
        <MetricGrid items={profileItems} />
      </section>
      <section className="data-panel attribute-panel fixed-panel">
        <h2>전체 능력치</h2>
        <AttributeTable
          attributes={career.player.attributes}
          leftFoot={career.player.leftFoot}
          rightFoot={career.player.rightFoot}
          selectedPosition={career.player.selectedPosition}
        />
      </section>
    </div>
  );
}

function ClubTab({ career, onOpenTeam }: { career: CareerState; onOpenTeam: OpenTeamHandler }) {
  const [activeSection, setActiveSection] = useState<ClubDashboardSection>("overview");
  const club = getCurrentClub(career);
  const publicClubInfo = getVisibleClubInfoItems(club);
  const publicStars = getPublicClubStars(club);
  const nextFixture = getNextPlayerFixture(career);
  const competitionNames = Object.values(career.competitions)
    .filter((competition) =>
      career.season.fixtures.some(
        (fixture) =>
          fixture.competitionId === competition.id &&
          (fixture.homeClubId === club.id || fixture.awayClubId === club.id),
      ),
    )
    .map((competition) => competition.name);
  const squadRows: DataTableRow[] = [
    [
      career.player.name,
      `${career.player.selectedPosition} · ${POSITION_LABELS[career.player.selectedPosition]}`,
      calculateOverall(career.player),
      SQUAD_ROLE_LABELS[career.squadRole],
      "등록 선수",
    ],
    [
      <>{renderTeamName(career, club.id, onOpenTeam, club.shortName)} 주전 그룹</>,
      "다수",
      formatStars(publicStars.squadStrengthStars),
      "주전",
      "공개 전력",
    ],
    [
      <>{renderTeamName(career, club.id, onOpenTeam, club.shortName)} 로테이션</>,
      "다수",
      formatStars(publicStars.squadStrengthStars),
      "로테이션",
      "경쟁 그룹",
    ],
    [
      <>{renderTeamName(career, club.id, onOpenTeam, club.shortName)} 유스 후보</>,
      "다수",
      formatStars(publicStars.youthOpportunityStars),
      "유망주",
      "성장 기회",
    ],
  ];

  return (
    <div className="stacked-tab fixed-tab">
      <SectionTabs
        tabs={CLUB_DASHBOARD_SECTIONS}
        activeTab={activeSection}
        ariaLabel="소속팀 하위 탭"
        onChange={setActiveSection}
      />

      {activeSection === "overview" ? (
        <div className="club-overview-grid">
          <section className="data-panel club-header">
            <h2>{renderTeamName(career, club.id, onOpenTeam)}</h2>
            <MetricGrid
              items={[
                { label: "연고지", value: club.city },
                { label: "리그", value: getLeagueName(club.leagueId) },
                { label: "약칭", value: club.shortName },
                ...publicClubInfo,
              ]}
            />
          </section>

          <section className="data-panel highlight-panel">
            <h2>다음 경기와 대회</h2>
            <MetricGrid
              items={[
                { label: "다음 경기", value: formatFixtureLink(career, nextFixture, onOpenTeam) },
                { label: "경기일", value: nextFixture ? formatDate(nextFixture.date) : "-" },
                {
                  label: "남은 일정",
                  value: `${getClubFixtures(career).filter((fixture) => fixture.status === "scheduled").length}경기`,
                },
                { label: "참가 대회", value: competitionNames.length > 0 ? competitionNames.join(", ") : "-" },
              ]}
            />
          </section>

          <section className="data-panel fixed-panel wide-panel">
            <h2>최근 결과</h2>
            <PaginatedDataTable
              columns={["날짜", "장소", "상대", "결과", "내 출전"]}
              rows={getClubRecentResultDisplayRows(career, onOpenTeam)}
              emptyMessage="아직 치른 경기가 없습니다."
              pageSize={6}
            />
          </section>
        </div>
      ) : null}

      {activeSection === "schedule" ? (
        <section className="data-panel fixed-panel">
          <h2>팀 일정</h2>
          <PaginatedDataTable
            columns={["라운드", "날짜", "대회", "장소", "상대", "결과"]}
            rows={getClubFixtureDisplayRows(career, onOpenTeam)}
            emptyMessage="팀 일정이 없습니다."
          />
        </section>
      ) : null}

      {activeSection === "squad" ? (
        <div className="club-squad-grid">
          <section className="data-panel fixed-panel">
            <h2>스쿼드 리스트</h2>
            <DataTable columns={["선수/그룹", "포지션", "평가", "역할", "상태"]} rows={squadRows} />
          </section>
          <section className="data-panel fixed-panel">
            <h2>최근 결과</h2>
            <PaginatedDataTable
              columns={["날짜", "장소", "상대", "결과", "내 출전"]}
              rows={getClubRecentResultDisplayRows(career, onOpenTeam)}
              emptyMessage="아직 치른 경기가 없습니다."
              pageSize={6}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}

function getCareerTotals(career: CareerState) {
  return career.careerHistory.reduce(
    (totals, entry) => ({
      appearances: totals.appearances + entry.appearances,
      goals: totals.goals + entry.goals,
      assists: totals.assists + entry.assists,
      ratingTotal: totals.ratingTotal + entry.averageRating * entry.appearances,
      ratingApps: totals.ratingApps + entry.appearances,
    }),
    {
      appearances: career.seasonStats.appearances,
      goals: career.seasonStats.goals,
      assists: career.seasonStats.assists,
      ratingTotal: career.seasonStats.averageRating * career.seasonStats.appearances,
      ratingApps: career.seasonStats.appearances,
    },
  );
}

function CareerTab({ career, onOpenTeam }: { career: CareerState; onOpenTeam: OpenTeamHandler }) {
  const [activeSection, setActiveSection] = useState<CareerDashboardSection>("season");
  const totals = getCareerTotals(career);
  const totalAverageRating = totals.ratingApps > 0 ? totals.ratingTotal / totals.ratingApps : 0;
  const matchPlayers = career.playerAppearanceLogs
    .map((log) => getPlayerFromAppearance(career, log))
    .filter((player): player is MatchPlayer => Boolean(player));
  const yellowCards = matchPlayers.reduce((total, player) => total + player.yellowCards, 0);
  const redCards = matchPlayers.filter((player) => player.redCard).length;
  const injuryRows = [
    ...career.notices
      .filter((notice) => notice.title.includes("부상") || notice.description.includes("부상"))
      .map((notice) => [career.season.year, notice.title, notice.description]),
    ...career.eventLog
      .filter((entry) => entry.type === "injury_warning")
      .map((entry) => [formatDate(entry.createdAt), entry.title, entry.description]),
  ].slice(-8).reverse();
  const clubHistory = [
    ...career.careerHistory.map((entry) => ({
      id: entry.id,
      title: renderTeamName(career, entry.clubId, onOpenTeam, entry.clubName),
      description: `${entry.year} · ${entry.leagueName} · ${entry.appearances}경기`,
    })),
    {
      id: `current-${career.player.clubId}`,
      title: renderTeamName(career, getCurrentClub(career).id, onOpenTeam),
      description: `${career.season.year} · 현재 소속 · ${career.seasonStats.appearances}경기`,
    },
  ];
  const milestones = [
    ...career.careerHistory
      .filter((entry): entry is CareerHistoryEntry & { achievement: string } => Boolean(entry.achievement))
      .map((entry) => ({
        id: entry.id,
        title: entry.achievement,
        description: (
          <>
            {entry.year} · {renderTeamName(career, entry.clubId, onOpenTeam, entry.clubName)} · {entry.leagueName}
          </>
        ),
      })),
    ...career.eventLog.slice(-6).map((entry) => ({
      id: entry.id,
      title: entry.title,
      description: entry.description,
    })),
  ].slice(-8).reverse();
  const seasonHistoryRows: DataTableRow[] = career.careerHistory.map((entry) => [
    `${entry.year}`,
    renderTeamName(career, entry.clubId, onOpenTeam, entry.clubName),
    entry.leagueName,
    `${entry.leaguePosition}위`,
    entry.appearances,
    entry.goals,
    entry.assists,
    entry.averageRating.toFixed(2),
    entry.achievement ?? "-",
  ]);

  return (
    <div className="stacked-tab fixed-tab">
      <SectionTabs
        tabs={CAREER_DASHBOARD_SECTIONS}
        activeTab={activeSection}
        ariaLabel="커리어 하위 탭"
        onChange={setActiveSection}
      />

      {activeSection === "season" ? (
        <div className="career-summary-grid">
          <section className="data-panel">
            <h2>이번 시즌 기록</h2>
            <MetricGrid
              items={[
                { label: "출전", value: `${career.seasonStats.appearances}경기` },
                { label: "출전 시간", value: `${career.seasonStats.minutesPlayed}분` },
                { label: "골", value: career.seasonStats.goals },
                { label: "도움", value: career.seasonStats.assists },
                { label: "평균 평점", value: career.seasonStats.averageRating.toFixed(2) },
                { label: "경고", value: yellowCards },
                { label: "퇴장", value: redCards },
                { label: "부상 상태", value: career.injury.severity === "healthy" ? "건강" : career.injury.description ?? "관리 필요" },
                { label: "계약", value: `${career.contractYearsLeft}년 남음` },
                { label: "연봉", value: `${career.salary.toLocaleString("ko-KR")}만` },
                { label: "역할", value: SQUAD_ROLE_LABELS[career.squadRole] },
              ]}
            />
          </section>

          <section className="data-panel">
            <h2>커리어 합산</h2>
            <MetricGrid
              items={[
                { label: "총 출전", value: `${totals.appearances}경기` },
                { label: "총 골", value: totals.goals },
                { label: "총 도움", value: totals.assists },
                { label: "통산 평점", value: totalAverageRating.toFixed(2) },
                { label: "소속 팀 수", value: new Set([...career.careerHistory.map((entry) => entry.clubId), career.player.clubId]).size },
                { label: "완료 시즌", value: career.careerHistory.length },
              ]}
            />
          </section>

          <section className="data-panel fixed-panel wide-panel">
            <h2>부상 기록</h2>
            <PaginatedDataTable
              columns={["시점", "상태", "내용"]}
              rows={injuryRows}
              emptyMessage="기록된 부상이 없습니다."
              pageSize={5}
            />
          </section>
        </div>
      ) : null}

      {activeSection === "logs" ? (
        <div className="career-log-grid">
          <section className="data-panel fixed-panel">
            <h2>최근 결과</h2>
            <PaginatedDataTable
              columns={["날짜", "경기", "결과", "소속팀"]}
              rows={getCareerRecentResultDisplayRows(career, onOpenTeam)}
              emptyMessage="아직 최근 결과가 없습니다."
              pageSize={6}
            />
          </section>

          <section className="data-panel fixed-panel">
            <h2>출전 기록과 평점</h2>
            <PaginatedDataTable
              columns={["날짜", "대회", "상대", "장소", "포지션", "시간", "평점", "골", "도움", "카드", "부상"]}
              rows={getCareerAppearanceDisplayRows(career, onOpenTeam)}
              emptyMessage="아직 출전 기록이 없습니다."
              pageSize={6}
            />
          </section>
        </div>
      ) : null}

      {activeSection === "history" ? (
        <div className="career-history-grid">
          <section className="data-panel fixed-panel">
            <h2>시즌/팀 히스토리</h2>
            <PaginatedDataTable
              columns={["시즌", "팀", "리그", "순위", "출전", "골", "도움", "평점", "업적"]}
              rows={seasonHistoryRows}
              emptyMessage="완료된 시즌 기록이 없습니다."
              pageSize={6}
            />
          </section>

          <section className="data-panel fixed-panel">
            <h2>팀 히스토리</h2>
            <div className="panel-scroll">
              <PanelList emptyMessage="아직 팀 히스토리가 없습니다." items={clubHistory} />
            </div>
          </section>

          <section className="data-panel fixed-panel">
            <h2>커리어 마일스톤</h2>
            <div className="panel-scroll">
              <PanelList emptyMessage="아직 기록된 마일스톤이 없습니다." items={milestones} />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function LeagueTable({
  career,
  leagueId,
  onOpenTeam,
}: {
  career: CareerState;
  leagueId: LeagueTier;
  onOpenTeam: OpenTeamHandler;
}) {
  return (
    <PaginatedDataTable
      columns={["순위", "팀", "경기", "승점", "승", "무", "패", "득실", "구역"]}
      rows={getLeagueStandingsDisplayRows(career, leagueId, onOpenTeam)}
    />
  );
}

function LeagueTab({ career, onOpenTeam }: { career: CareerState; onOpenTeam: OpenTeamHandler }) {
  const currentClub = getCurrentClub(career);
  const leagueIds = Object.keys(career.leagues) as LeagueTier[];
  const [selectedLeagueId, setSelectedLeagueId] = useState<LeagueTier>(currentClub.leagueId);
  const [activeSection, setActiveSection] = useState<LeagueDashboardSection>("standings");
  const selectedLeague = career.leagues[selectedLeagueId];
  const selectedLeagueFixtures = career.season.fixtures
    .filter((fixture) => fixture.competitionId === selectedLeague.competitionId)
    .slice(0, 160);
  const cupCompetitions = Object.values(career.competitions).filter(
    (competition) => competition.type === "cup" || competition.type === "playoff",
  );
  const domesticCupCompetitions = cupCompetitions.filter((competition) => competition.type === "cup");
  const cupBracketSections = domesticCupCompetitions.map((competition) => {
    const fixtures = career.season.fixtures
      .filter((fixture) => fixture.competitionId === competition.id)
      .sort(
        (left, right) =>
          left.round - right.round ||
          left.date.localeCompare(right.date) ||
          left.id.localeCompare(right.id),
      );
    const rounds = [...new Set(fixtures.map((fixture) => fixture.round))].map((round) => ({
      round,
      label: getDomesticCupRoundLabel(round),
      fixtures: fixtures.filter((fixture) => fixture.round === round),
    }));

    return { competition, rounds };
  });

  return (
    <div className="stacked-tab fixed-tab league-tab-layout">
      <section className="data-panel league-control-panel">
        <div className="league-browser-header">
          <div>
            <h2>리그 브라우저</h2>
            <p>{selectedLeague.country} · {selectedLeague.name}</p>
          </div>
          <label>
            리그 선택
            <select
              aria-label="리그 선택"
              value={selectedLeagueId}
              onChange={(event) => setSelectedLeagueId(event.target.value as LeagueTier)}
            >
              {leagueIds.map((leagueId) => (
                <option key={leagueId} value={leagueId}>
                  {career.leagues[leagueId].name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <MetricGrid
          items={[
            { label: "참가 팀", value: selectedLeague.clubs.length },
            { label: "라운드 로빈", value: `${selectedLeague.ruleSet.roundRobinCycles}회` },
            { label: "직행 승격", value: selectedLeague.ruleSet.directPromotionSlots },
            {
              label: "승격 PO",
              value: selectedLeague.ruleSet.promotionPlayoffConfig
                ? `${selectedLeague.ruleSet.promotionPlayoffConfig.entrantPositionStart}-${selectedLeague.ruleSet.promotionPlayoffConfig.entrantPositionEnd}위`
                : 0,
            },
            { label: "직행 강등", value: selectedLeague.ruleSet.directRelegationSlots },
            {
              label: "강등 PO",
              value: selectedLeague.ruleSet.relegationPlayoffConfig?.entrantPositionsFromBottom?.length ?? 0,
            },
          ]}
        />
      </section>

      <SectionTabs
        tabs={LEAGUE_DASHBOARD_SECTIONS}
        activeTab={activeSection}
        ariaLabel="리그 하위 탭"
        onChange={setActiveSection}
      />

      {activeSection === "standings" ? (
        <section className="data-panel fixed-panel">
          <h2>{selectedLeague.name} 순위표</h2>
          <LeagueTable career={career} leagueId={selectedLeagueId} onOpenTeam={onOpenTeam} />
        </section>
      ) : null}

      {activeSection === "fixtures" ? (
        <section className="data-panel fixed-panel">
          <h2>{selectedLeague.name} 일정/결과</h2>
          <PaginatedDataTable
            columns={["라운드", "날짜", "홈", "원정", "상태"]}
            rows={selectedLeagueFixtures.map((fixture) => [
              fixtureRoundText(fixture),
              formatDate(fixture.date),
              renderTeamName(career, fixture.homeClubId, onOpenTeam),
              renderTeamName(career, fixture.awayClubId, onOpenTeam),
              fixture.status === "played" ? resultText(fixture) : "예정",
            ])}
          />
        </section>
      ) : null}

      {activeSection === "rules" ? (
        <div className="league-rules-grid">
          <section className="data-panel fixed-panel">
            <h2>승강 요약</h2>
            <div className="panel-scroll">
              <PromotionRelegationSummary career={career} onOpenTeam={onOpenTeam} />
            </div>
          </section>

          <section className="data-panel fixed-panel">
            <h2>플레이오프</h2>
            <PlayoffBracketPanel career={career} onOpenTeam={onOpenTeam} />
          </section>

          <section className="data-panel">
            <h2>승강 구역</h2>
            <p className="empty-note">
              {career.season.promotionRelegation?.note ??
                `${selectedLeague.name} 규정에 따라 승격, 강등, 플레이오프 구역을 순위표에 표시합니다.`}
            </p>
          </section>
        </div>
      ) : null}

      {activeSection === "cups" ? (
        <div className="league-cup-grid">
          <section className="data-panel fixed-panel">
            <h2>컵 대회</h2>
            <PaginatedDataTable
              columns={["대회", "유형", "참가 리그", "경기 수"]}
              rows={cupCompetitions.map((competition) => [
                competition.name,
                competition.type === "playoff" ? "플레이오프" : "컵",
                competition.leagueIds.map((leagueId) => getLeagueName(leagueId)).join(", "),
                competition.fixtureIds.length,
              ])}
              emptyMessage="현재 별도 컵이나 대륙 대회 순위표는 없습니다."
              pageSize={6}
            />
          </section>

          <section className="data-panel fixed-panel">
            <h2>컵 진행표</h2>
            <div className="panel-scroll">
              {cupBracketSections.length === 0 ? (
                <p className="empty-note">이번 시즌 국내 컵 진행이 아직 없습니다.</p>
              ) : (
                cupBracketSections.map(({ competition, rounds }) => (
                  <div className="cup-bracket-block" key={competition.id}>
                    <h3>{competition.name}</h3>
                    {rounds.map((round) => (
                      <div className="cup-round-block" key={`${competition.id}-${round.round}`}>
                        <h4>{round.label}</h4>
                        <PaginatedDataTable
                          columns={["날짜", "홈", "원정", "결과"]}
                          rows={round.fixtures.map((fixture) => [
                            formatDate(fixture.date),
                            renderTeamName(career, fixture.homeClubId, onOpenTeam),
                            renderTeamName(career, fixture.awayClubId, onOpenTeam),
                            fixture.status === "played" ? resultText(fixture) : "예정",
                          ])}
                          pageSize={6}
                        />
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export function CareerDashboardScreen({
  career,
  savedAtLabel,
  saveError,
  saveMessage,
  onCareerChange,
  onDeleteSave,
  onSaveCareer,
}: CareerDashboardScreenProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("main");
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [negotiatingOfferId, setNegotiatingOfferId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const club = useMemo(() => getCurrentClub(career), [career]);
  const negotiatingOffer = useMemo(
    () => career.transferOffers.find((offer) => offer.id === negotiatingOfferId),
    [career.transferOffers, negotiatingOfferId],
  );

  const advance = () => {
    try {
      const updatedCareer = advanceWeek(career, {
        selectedChoiceId: selectedChoiceId ?? career.currentEvent?.choices[0]?.id,
      });
      setSelectedChoiceId(null);
      setActionError(null);
      setActionMessage(
        updatedCareer.activeMatchId
          ? "이번 주 경기를 준비합니다."
          : updatedCareer.season.isComplete
            ? "시즌이 종료되었습니다."
            : `${formatDate(updatedCareer.currentDate)} 주로 이동했습니다.`,
      );
      onCareerChange(updatedCareer);
    } catch {
      setActionError("주간 진행을 처리하지 못했습니다. 저장 상태를 확인해주세요.");
      setActionMessage(null);
    }
  };

  const progressMatch = (action: MatchAction) => {
    try {
      const updatedCareer = progressActiveMatch(career, action, {
        selectedChoiceId: selectedChoiceId ?? career.currentEvent?.choices[0]?.id,
      });
      setSelectedChoiceId(null);
      setActionError(null);
      setActionMessage(
        updatedCareer.activeMatchId
          ? "경기를 진행했습니다."
          : updatedCareer.season.isComplete
            ? "시즌이 종료되었습니다."
            : `${formatDate(updatedCareer.currentDate)} 주로 이동했습니다.`,
      );
      onCareerChange(updatedCareer);
    } catch {
      setActionError("경기 진행을 처리하지 못했습니다. 저장 상태를 확인해주세요.");
      setActionMessage(null);
    }
  };

  const nextSeason = () => {
    try {
      const updatedCareer = startNextSeason(career);
      setSelectedChoiceId(null);
      setActionError(null);
      setActionMessage("새 시즌이 시작되었습니다.");
      onCareerChange(updatedCareer);
    } catch {
      setActionError("아직 다음 시즌을 시작할 수 없습니다.");
      setActionMessage(null);
    }
  };

  const negotiateTransfer = (offerId: string) => {
    setNegotiatingOfferId(offerId);
    setActionError(null);
  };

  const acceptTransfer = (offerId: string) => {
    try {
      const updatedCareer = acceptTransferOffer(career, offerId);
      setNegotiatingOfferId(null);
      setActionError(null);
      setActionMessage("이적 제안을 수락했습니다.");
      onCareerChange(updatedCareer);
    } catch {
      setActionError("이적 제안을 수락하지 못했습니다. 제안 상태를 확인해주세요.");
      setActionMessage(null);
    }
  };

  const rejectTransfer = (offerId: string) => {
    try {
      const updatedCareer = rejectTransferOffer(career, offerId);
      setNegotiatingOfferId(null);
      setActionError(null);
      setActionMessage("이적 제안을 거절했습니다.");
      onCareerChange(updatedCareer);
    } catch {
      setActionError("이적 제안을 거절하지 못했습니다. 제안 상태를 확인해주세요.");
      setActionMessage(null);
    }
  };

  const holdTransfer = (offerId: string) => {
    try {
      const updatedCareer = holdTransferOffer(career, offerId);
      setActionError(null);
      setActionMessage("이적 제안을 보류했습니다.");
      onCareerChange(updatedCareer);
    } catch {
      setActionError("이적 제안을 보류하지 못했습니다. 제안 상태를 확인해주세요.");
      setActionMessage(null);
    }
  };

  const handleNegotiationAction = (action: TransferNegotiationAction) => {
    if (!negotiatingOfferId) {
      return;
    }

    try {
      const outcome = applyTransferNegotiationAction(career, negotiatingOfferId, action);
      const shouldClose =
        action === "accept" ||
        action === "reject" ||
        outcome.result === "club_withdraws_offer" ||
        outcome.offer.negotiation.status === "withdrawn";

      setNegotiatingOfferId(shouldClose ? null : outcome.offer.id);
      setActionError(null);
      setActionMessage(outcome.message);
      onCareerChange(outcome.career);
    } catch {
      setActionError("이적 협상을 처리하지 못했습니다. 제안 상태를 확인해주세요.");
      setActionMessage(null);
    }
  };

  if (career.activeMatchId) {
    return (
      <MatchScreen
        career={career}
        savedAtLabel={savedAtLabel}
        saveError={saveError}
        saveMessage={saveMessage}
        actionError={actionError}
        actionMessage={actionMessage}
        onMatchAction={progressMatch}
        onDeleteSave={onDeleteSave}
        onSaveCareer={onSaveCareer}
      />
    );
  }

  return (
    <ScreenShell
      eyebrow={
        <>
          {renderTeamName(career, club.id, setSelectedTeamId)} · {career.season.year} 시즌
        </>
      }
      title={career.player.name}
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
      navigation={
        <nav className="tab-bar" aria-label="커리어 탭">
          {CAREER_DASHBOARD_TABS.map((tab) => (
            <button
              className={activeTab === tab.id ? "tab-button active" : "tab-button"}
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      }
      wide
    >
      <div className="career-dashboard">
        {saveError ? <div className="save-alert" role="alert">{saveError}</div> : null}
        {saveMessage ? <div className="save-status" role="status">{saveMessage}</div> : null}
        {actionError ? <div className="save-alert" role="alert">{actionError}</div> : null}
        {actionMessage ? <div className="save-status" role="status">{actionMessage}</div> : null}

        {activeTab === "main" ? (
          <MainTab
            career={career}
            selectedChoiceId={selectedChoiceId}
            onSelectChoice={setSelectedChoiceId}
            onAdvanceWeek={advance}
            onStartNextSeason={nextSeason}
            onNegotiateTransfer={negotiateTransfer}
            onAcceptTransfer={acceptTransfer}
            onRejectTransfer={rejectTransfer}
            onHoldTransfer={holdTransfer}
            onOpenTeam={setSelectedTeamId}
          />
        ) : null}
        {activeTab === "player" ? <PlayerTab career={career} onOpenTeam={setSelectedTeamId} /> : null}
        {activeTab === "club" ? <ClubTab career={career} onOpenTeam={setSelectedTeamId} /> : null}
        {activeTab === "career" ? <CareerTab career={career} onOpenTeam={setSelectedTeamId} /> : null}
        {activeTab === "league" ? <LeagueTab career={career} onOpenTeam={setSelectedTeamId} /> : null}

        <p className="saved-at">최근 저장 {savedAtLabel ?? "아직 없음"}</p>

        {negotiatingOffer ? (
          <TransferNegotiationModal
            offer={negotiatingOffer}
            currentClub={club}
            onClose={() => setNegotiatingOfferId(null)}
            onAction={handleNegotiationAction}
            onOpenTeam={setSelectedTeamId}
          />
        ) : null}

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
