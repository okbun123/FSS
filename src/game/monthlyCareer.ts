import {
  FICTIONAL_LEAGUES,
  createFictionalCompetitions,
  getClubsById,
  getClubById,
  getLeagueName,
} from "../data/fictionalLeagues";
import type {
  CareerEventLogEntry,
  CareerHistoryEntry,
  CareerState,
  Club,
  Fixture,
  FixtureResult,
  League,
  LeagueTier,
  Match,
  MonthlyNotice,
  PlayerAppearanceLog,
  RecentResult,
  Season,
  SeasonStats,
  TransferOffer,
} from "../domain/types";
import {
  advanceMatch,
  createMatchForFixture,
  fastForwardMatchToFinish,
  isMatchReadyToFinalize,
  type MatchAction,
} from "../domain/matchStateMachine";
import { createPlayerFromRoll, type PlayerRoll } from "./playerGeneration";
import { calculateMarketValue, calculateOverall } from "./overall";
import { generateMonthlyEvent, applyMonthlyEventChoice, getEventInjuryRisk } from "./monthlyEvents";
import {
  generateLeagueFixtures,
  createSeasonMonths,
  createWeekTurns,
  getDefaultLeagueSeasonStartDate,
} from "./leagueSchedule";
import {
  calculateLeagueTable,
  getClubLeaguePosition,
} from "./leagueTable";
import { applyMonthlyGrowth } from "./monthlyGrowth";
import { createSeededRandom, type RandomSource } from "./random";
import { createUnifiedFeedForCareer } from "../domain/feed";
import { createTransferOfferForCareer } from "../domain/transfers";
import {
  getAggregateScoreBeforeFixture,
  shouldUseKnockoutMatchState,
} from "../domain/playoffs";
import {
  createInitialDomesticCupFixtures,
  ensureCupWinner,
  getCupResultLabel,
  isDomesticCupFixture,
  progressDomesticCupFixtures,
} from "../domain/domesticCup";
import { progressPromotionRelegation } from "../domain/promotionRelegation";
import { applySeasonRollover } from "../domain/seasonRollover";
import { applyClubSeasonEvolution } from "../domain/clubEvolution";
import { createInitialNegotiation } from "../domain/negotiation";
import { calculateTeamFit } from "../domain/teamFit";

export interface CreateMonthlyCareerInput {
  name: string;
  nationality: string;
  clubId: string;
  position: CareerState["player"]["selectedPosition"];
  roll: PlayerRoll;
}

export interface AdvanceMonthInput {
  selectedChoiceId?: string;
  createdAt?: string;
}

export interface AdvanceWeekInput {
  selectedChoiceId?: string;
  createdAt?: string;
}

interface MonthSimulationResult {
  fixtures: Fixture[];
  statsDelta: SeasonStats;
  averageRatingFromMonth: number;
  playingTimeShare: number;
  notices: MonthlyNotice[];
  appearanceLogs: PlayerAppearanceLog[];
  recentResults: RecentResult[];
}

const EVENT_LOG_LIMIT = 80;
const APPEARANCE_LOG_LIMIT = 160;
const RECENT_RESULT_LIMIT = 16;

type PlayerAppearanceResult = Required<
  Pick<
    FixtureResult,
    "playerAppeared" | "playerMinutes" | "playerRating" | "playerGoals" | "playerAssists"
  >
>;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, precision = 2): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

function formatSignedDelta(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function isoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function addDays(dateIso: string, days: number): string {
  const date = new Date(dateIso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function getSeasonStartDate(year: number): string {
  return getDefaultLeagueSeasonStartDate(year);
}

function getMonthStartDate(year: number, month: number): string {
  return isoDate(year, Math.min(Math.max(month, 1), 12), 1);
}

function getWeekStartDate(dateIso: string): string {
  const date = new Date(dateIso);
  const daysFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return date.toISOString();
}

function isSameMonth(leftIso: string, rightIso: string): boolean {
  const left = new Date(leftIso);
  const right = new Date(rightIso);
  return left.getUTCFullYear() === right.getUTCFullYear() && left.getUTCMonth() === right.getUTCMonth();
}

function emptySeasonStats(): SeasonStats {
  return {
    appearances: 0,
    minutesPlayed: 0,
    goals: 0,
    assists: 0,
    averageRating: 0,
  };
}

function createEventLogEntry(input: {
  career: CareerState;
  type: CareerEventLogEntry["type"];
  title: string;
  description: string;
  idSuffix: string;
  createdAt?: string;
  month?: number;
  seasonNumber?: number;
}): CareerEventLogEntry {
  const seasonNumber = input.seasonNumber ?? input.career.season.number;
  const month = input.month ?? input.career.season.currentMonth;

  return {
    id: `season-${seasonNumber}-month-${month}-${input.idSuffix}`,
    seasonNumber,
    month,
    type: input.type,
    title: input.title,
    description: input.description,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

function appendEventLog(career: CareerState, entry: CareerEventLogEntry): CareerState {
  return {
    ...career,
    eventLog: [...(career.eventLog ?? []), entry].slice(-EVENT_LOG_LIMIT),
  };
}

function withUnifiedFeed(career: CareerState): CareerState {
  return {
    ...career,
    unifiedFeed: createUnifiedFeedForCareer(career),
  };
}

function withSyncedPlayerMetrics(career: CareerState): CareerState {
  const selectedPosition = career.player.selectedPosition ?? career.player.position;
  const playerBase = {
    ...career.player,
    selectedPosition,
    position: selectedPosition,
    form: career.form,
    condition: career.condition,
    fatigue: career.fatigue,
    reputation: career.reputation,
    coachTrust: career.coachTrust,
  };
  const OVR = calculateOverall(playerBase, selectedPosition);

  return {
    ...career,
    player: {
      ...playerBase,
      OVR,
      marketValue: calculateMarketValue({ ...playerBase, OVR }, career.reputation),
    },
  };
}

function createTables(leagues: Record<LeagueTier, League>, fixtures: readonly Fixture[]) {
  return Object.fromEntries(
    Object.entries(leagues).map(([leagueId, league]) => [
      leagueId,
      calculateLeagueTable(league, fixtures),
    ]),
  ) as Record<LeagueTier, ReturnType<typeof calculateLeagueTable>>;
}

function sortFixturesByDate(fixtures: readonly Fixture[]): Fixture[] {
  return [...fixtures].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.round - right.round ||
      left.id.localeCompare(right.id),
  );
}

function replaceFixture(fixtures: readonly Fixture[], updatedFixture: Fixture): Fixture[] {
  return fixtures.map((fixture) => (fixture.id === updatedFixture.id ? updatedFixture : fixture));
}

function withFixtures(career: CareerState, fixtures: Fixture[]): CareerState {
  const progressedFixtures = progressDomesticCupFixtures({
    fixtures,
    clubsById: career.clubs,
    seasonNumber: career.season.number,
    seasonYear: career.season.year,
  });
  const weekTurns = progressedFixtures.length === fixtures.length
    ? career.weekTurns
    : updateWeekTurnStatuses(createWeekTurns(progressedFixtures), career.currentDate);

  return {
    ...career,
    fixtures: progressedFixtures,
    weekTurns,
    season: {
      ...career.season,
      fixtures: progressedFixtures,
      months: createSeasonMonths(progressedFixtures, career.season.totalMonths),
      tables: createTables(career.leagues, progressedFixtures),
    },
    competitions: createFictionalCompetitions(career.season.number, progressedFixtures),
  };
}

function updateWeekTurnStatuses(weekTurns: readonly CareerState["weekTurns"][number][], currentDate: string) {
  const currentWeekStart = getWeekStartDate(currentDate);

  return weekTurns.map((weekTurn) => ({
    ...weekTurn,
    status:
      weekTurn.startDate < currentWeekStart
        ? "completed" as const
        : weekTurn.startDate === currentWeekStart
          ? "active" as const
          : "upcoming" as const,
  }));
}

function areFixturesComplete(fixtures: readonly Fixture[]): boolean {
  return fixtures.every((fixture) => fixture.status === "played" || fixture.status === "postponed");
}

function areRegularSeasonFixturesComplete(fixtures: readonly Fixture[]): boolean {
  const regularFixtures = fixtures.filter((fixture) => !fixture.playoff && !isDomesticCupFixture(fixture));

  return regularFixtures.length > 0 && areFixturesComplete(regularFixtures);
}

function withPromotionRelegationProgress(career: CareerState): CareerState {
  if (!areRegularSeasonFixturesComplete(career.fixtures)) {
    return career;
  }

  const tables = createTables(career.leagues, career.fixtures);
  const progress = progressPromotionRelegation({
    seasonNumber: career.season.number,
    seasonStartYear: career.season.year,
    leagues: career.leagues,
    tables,
    fixtures: career.fixtures,
    currentStatus: career.season.promotionRelegation,
    leagueMode: career.leagueMode ?? "gameplay",
  });
  const fixtures = progress.fixtures;
  const weekTurns = progress.addedFixtureIds.length > 0
    ? updateWeekTurnStatuses(createWeekTurns(fixtures), career.currentDate)
    : career.weekTurns;

  return {
    ...career,
    fixtures,
    weekTurns,
    competitions: createFictionalCompetitions(career.season.number, fixtures),
    season: {
      ...career.season,
      fixtures,
      months: createSeasonMonths(fixtures, career.season.totalMonths),
      tables: createTables(career.leagues, fixtures),
      promotionRelegation: progress.status,
    },
  };
}

function withSeasonCompletionState(career: CareerState): CareerState {
  const progressed = withPromotionRelegationProgress(career);
  const promotionRelegationResolved = progressed.season.promotionRelegation?.isResolved ?? true;
  const isComplete = areFixturesComplete(progressed.fixtures) && promotionRelegationResolved;

  return {
    ...progressed,
    season: {
      ...progressed.season,
      isComplete,
    },
  };
}

function isPlayerClubFixture(career: CareerState, fixture: Fixture): boolean {
  const clubId = career.player.clubId;
  return fixture.homeClubId === clubId || fixture.awayClubId === clubId;
}

function getWeekWindow(currentDate: string): { start: string; endExclusive: string; endInclusive: string } {
  return {
    start: currentDate,
    endExclusive: addDays(currentDate, 7),
    endInclusive: addDays(currentDate, 6),
  };
}

export function getFixturesBetweenDates(
  fixtures: readonly Fixture[],
  startDate: string,
  endDateInclusive: string,
): Fixture[] {
  const startTime = new Date(startDate).getTime();
  const endExclusive = new Date(addDays(endDateInclusive, 1)).getTime();

  return sortFixturesByDate(
    fixtures.filter((fixture) => {
      const fixtureTime = new Date(fixture.date).getTime();
      return fixtureTime >= startTime && fixtureTime < endExclusive;
    }),
  );
}

export function getCurrentWeekFixtures(career: CareerState): Fixture[] {
  const { start, endInclusive } = getWeekWindow(career.currentDate);
  return getFixturesBetweenDates(career.fixtures, start, endInclusive);
}

export function getCurrentWeekPlayerFixtures(career: CareerState): Fixture[] {
  return getCurrentWeekFixtures(career).filter((fixture) => isPlayerClubFixture(career, fixture));
}

function getPendingCurrentWeekFixtures(career: CareerState): Fixture[] {
  return getCurrentWeekFixtures(career).filter(
    (fixture) => fixture.status === "scheduled" || fixture.status === "inProgress",
  );
}

function createSeason(
  leagues: Record<LeagueTier, League>,
  seasonNumber: number,
  year: number,
): Season {
  const seasonStartDate = getSeasonStartDate(year);
  const currentMonth = new Date(getWeekStartDate(seasonStartDate)).getUTCMonth() + 1;
  const fixtures = [
    ...Object.values(leagues).flatMap((league) =>
      generateLeagueFixtures(league, { seasonNumber, totalMonths: 12, seasonStartDate }),
    ),
    ...createInitialDomesticCupFixtures({
      clubs: Object.values(leagues).flatMap((league) => league.clubs),
      seasonNumber,
      seasonYear: year,
    }),
  ].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.round - right.round ||
      left.id.localeCompare(right.id),
  );

  return {
    id: `season-${seasonNumber}`,
    number: seasonNumber,
    year,
    currentMonth,
    totalMonths: 12,
    months: createSeasonMonths(fixtures, 12),
    fixtures,
    tables: createTables(leagues, fixtures),
    isComplete: false,
  };
}

function getCareerClub(career: CareerState): Club {
  const club = career.clubs[career.player.clubId] ?? getClubById(career.player.clubId);

  if (!club) {
    throw new Error(`Unknown club: ${career.player.clubId}`);
  }

  return club;
}

export function getCurrentClub(career: CareerState): Club {
  return getCareerClub(career);
}

export function getCurrentLeague(career: CareerState): League {
  const club = getCareerClub(career);
  return career.leagues[club.leagueId];
}

export function getCurrentMonthFixtures(career: CareerState): Fixture[] {
  const club = getCareerClub(career);

  return career.season.fixtures.filter(
    (fixture) =>
      fixture.month === career.season.currentMonth &&
      (fixture.homeClubId === club.id || fixture.awayClubId === club.id),
  );
}

export function getNextPlayerFixture(career: CareerState): Fixture | undefined {
  const club = getCareerClub(career);

  return career.season.fixtures.find(
    (fixture) =>
      fixture.status === "scheduled" &&
      (fixture.homeClubId === club.id || fixture.awayClubId === club.id),
  );
}

function getClubStrength(career: CareerState, clubId: string): number {
  return (career.clubs[clubId] ?? getClubById(clubId))?.squadStrength ?? 58;
}

function getExpectedGoals(strength: number, rng: RandomSource, homeAdvantage = 0): number {
  const raw = 0.25 + strength / 44 + homeAdvantage + rng() * 1.25;
  return Math.max(0, Math.min(5, Math.floor(raw)));
}

function getScoreWinner(fixture: Fixture, result: FixtureResult): string | undefined {
  if (result.homeGoals > result.awayGoals) {
    return fixture.homeClubId;
  }

  if (result.awayGoals > result.homeGoals) {
    return fixture.awayClubId;
  }

  return undefined;
}

function completeSimulatedPlayoffResult(
  career: CareerState,
  fixture: Fixture,
  result: FixtureResult,
  rng: RandomSource,
): FixtureResult {
  if (!fixture.playoff) {
    return result;
  }

  if (fixture.playoff.tieFormat === "singleLeg") {
    return {
      ...result,
      winnerClubId: getScoreWinner(fixture, result) ?? fixture.playoff.drawAdvantageClubId,
      decidedBy: "normalTime",
    };
  }

  if (fixture.playoff.leg === 1) {
    return {
      ...result,
      decidedBy: "normalTime",
    };
  }

  const aggregate = getAggregateScoreBeforeFixture(career.fixtures, fixture);

  if (!aggregate) {
    return result;
  }

  const aggregateHomeGoals = aggregate.homeGoals + result.homeGoals;
  const aggregateAwayGoals = aggregate.awayGoals + result.awayGoals;

  if (aggregateHomeGoals > aggregateAwayGoals) {
    return {
      ...result,
      winnerClubId: fixture.homeClubId,
      decidedBy: "normalTime",
    };
  }

  if (aggregateAwayGoals > aggregateHomeGoals) {
    return {
      ...result,
      winnerClubId: fixture.awayClubId,
      decidedBy: "normalTime",
    };
  }

  if (rng() < 0.5) {
    const homeWinsExtraTime = rng() < 0.5;

    return {
      ...result,
      homeGoals: result.homeGoals + (homeWinsExtraTime ? 1 : 0),
      awayGoals: result.awayGoals + (homeWinsExtraTime ? 0 : 1),
      winnerClubId: homeWinsExtraTime ? fixture.homeClubId : fixture.awayClubId,
      decidedBy: "extraTime",
    };
  }

  const homeWinsPenalties = rng() < 0.5;

  return {
    ...result,
    winnerClubId: homeWinsPenalties ? fixture.homeClubId : fixture.awayClubId,
    decidedBy: "penalties",
    homePenaltyGoals: homeWinsPenalties ? 5 : 4,
    awayPenaltyGoals: homeWinsPenalties ? 4 : 5,
  };
}

function getAppearanceChance(career: CareerState, club: Club): number {
  if (career.injury.severity === "major") {
    return 4;
  }

  const ovr = calculateOverall(career.player);
  const roleBonus = career.squadRole === "keyPlayer" ? 25 : career.squadRole === "regular" ? 15 : career.squadRole === "rotation" ? 8 : 0;
  const injuryPenalty = career.injury.severity === "minor" ? 22 : 0;

  return clamp(
    42 +
      (ovr - club.squadStrength) * 1.4 +
      roleBonus +
      career.coachTrust * 0.22 +
      career.form * 0.12 -
      career.fatigue * 0.24 -
      injuryPenalty,
    5,
    94,
  );
}

function simulatePlayerAppearance(
  career: CareerState,
  club: Club,
  _fixture: Fixture,
  rng: RandomSource,
): PlayerAppearanceResult {
  const appearanceChance = getAppearanceChance(career, club);
  const appeared = rng() * 100 <= appearanceChance;

  if (!appeared) {
    return {
      playerAppeared: false,
      playerMinutes: 0,
      playerRating: 0,
      playerGoals: 0,
      playerAssists: 0,
    };
  }

  const ovr = calculateOverall(career.player);
  const minutes = Math.round(clamp(45 + rng() * 45 + (career.condition - career.fatigue) * 0.12, 12, 90));
  const position = career.player.selectedPosition;
  const attackBias = position === "ST" ? 1 : position === "LW" || position === "RW" || position === "AM" ? 0.75 : 0.25;
  const creationBias = position === "AM" || position === "CM" || position === "LW" || position === "RW" ? 0.72 : 0.32;
  const goalChance = clamp((ovr - 48) * attackBias + career.form * 0.12 + minutes * 0.08, 1, 58);
  const assistChance = clamp((ovr - 46) * creationBias + career.form * 0.1 + minutes * 0.07, 1, 54);
  const goals = rng() * 100 < goalChance ? 1 + (rng() < 0.08 ? 1 : 0) : 0;
  const assists = rng() * 100 < assistChance ? 1 : 0;
  const rating = round(clamp(5.8 + (ovr - club.squadStrength) / 18 + goals * 0.8 + assists * 0.55 + (rng() - 0.45), 4.5, 9.6), 1);

  return {
    playerAppeared: true,
    playerMinutes: minutes,
    playerRating: rating,
    playerGoals: goals,
    playerAssists: assists,
  };
}

function simulateFixture(career: CareerState, fixture: Fixture, rng: RandomSource): Fixture {
  if (fixture.status === "played") {
    return fixture;
  }

  const homeStrength = getClubStrength(career, fixture.homeClubId);
  const awayStrength = getClubStrength(career, fixture.awayClubId);
  const regularTimeResult: FixtureResult = {
    homeGoals: getExpectedGoals(homeStrength, rng, 0.14),
    awayGoals: getExpectedGoals(awayStrength, rng),
  };
  let result = regularTimeResult;
  const club = getCareerClub(career);

  if (fixture.homeClubId === club.id || fixture.awayClubId === club.id) {
    Object.assign(result, simulatePlayerAppearance(career, club, fixture, rng));
    const playerIsHome = fixture.homeClubId === club.id;

    if (result.playerGoals) {
      if (playerIsHome) {
        result.homeGoals = Math.min(5, result.homeGoals + result.playerGoals);
      } else {
        result.awayGoals = Math.min(5, result.awayGoals + result.playerGoals);
      }
    }
  }

  result = ensureCupWinner(fixture, completeSimulatedPlayoffResult(career, fixture, result, rng), rng);

  return {
    ...fixture,
    status: "played",
    result,
  };
}

function createFixtureResultFromMatch(career: CareerState, fixture: Fixture, match: Match): FixtureResult {
  const player = [
    ...match.lineups.home.starters,
    ...match.lineups.home.substitutes,
    ...match.lineups.away.starters,
    ...match.lineups.away.substitutes,
  ].find((matchPlayer) => matchPlayer.playerId === career.player.id || matchPlayer.isUserPlayer);
  const playerClub = getCareerClub(career);
  const playerAppeared = Boolean(player && (fixture.homeClubId === playerClub.id || fixture.awayClubId === playerClub.id));
  const playerMinutes = playerAppeared
    ? Math.max(player?.minutesPlayed ?? 0, player?.status === "onPitch" ? Math.min(match.state.minute, 120) : 0)
    : 0;
  const playerGoals = player?.goals ?? 0;
  const playerAssists = player?.assists ?? 0;
  const drawAdvantageWinner =
    fixture.playoff?.drawAdvantageClubId &&
    match.state.homeGoals === match.state.awayGoals
      ? fixture.playoff.drawAdvantageClubId
      : undefined;
  const winnerClubId = match.state.winnerClubId ?? drawAdvantageWinner;
  const playerWon = winnerClubId === playerClub.id;
  const playerRating = playerAppeared
    ? round(clamp(6.2 + playerGoals * 0.8 + playerAssists * 0.5 + (playerWon ? 0.25 : 0), 4.8, 9.8), 1)
    : 0;

  return {
    homeGoals: match.state.homeGoals,
    awayGoals: match.state.awayGoals,
    winnerClubId,
    decidedBy: match.state.shootout?.winnerClubId
      ? "penalties"
      : match.state.minute > 90
        ? "extraTime"
        : "normalTime",
    homePenaltyGoals: match.state.shootout?.homeGoals,
    awayPenaltyGoals: match.state.shootout?.awayGoals,
    playerAppeared,
    playerMinutes,
    playerRating,
    playerGoals,
    playerAssists,
  };
}

function combineAverageRating(previous: SeasonStats, delta: SeasonStats): number {
  const totalApps = previous.appearances + delta.appearances;

  if (totalApps === 0) {
    return 0;
  }

  return round(
    (previous.averageRating * previous.appearances + delta.averageRating * delta.appearances) /
      totalApps,
  );
}

function getFixtureOutcome(fixture: Fixture, clubId: string): RecentResult["outcome"] {
  if (!fixture.result) {
    return undefined;
  }

  const goalsFor = fixture.homeClubId === clubId ? fixture.result.homeGoals : fixture.result.awayGoals;
  const goalsAgainst = fixture.homeClubId === clubId ? fixture.result.awayGoals : fixture.result.homeGoals;

  if (goalsFor > goalsAgainst) {
    return "win";
  }

  if (goalsFor < goalsAgainst) {
    return "loss";
  }

  return "draw";
}

function createRecentResult(fixture: Fixture, playerClubId: string): RecentResult | undefined {
  if (!fixture.result) {
    return undefined;
  }

  return {
    id: `result-${fixture.id}`,
    fixtureId: fixture.id,
    matchId: fixture.matchId,
    date: fixture.date,
    competitionId: fixture.competitionId,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    homeGoals: fixture.result.homeGoals,
    awayGoals: fixture.result.awayGoals,
    playerClubId,
    outcome: getFixtureOutcome(fixture, playerClubId),
  };
}

function createAppearanceLog(
  career: CareerState,
  fixture: Fixture,
  club: Club,
): PlayerAppearanceLog | undefined {
  if (!fixture.result?.playerAppeared) {
    return undefined;
  }

  return {
    id: `appearance-${fixture.id}`,
    fixtureId: fixture.id,
    matchId: fixture.matchId,
    date: fixture.date,
    seasonNumber: fixture.seasonNumber,
    competitionId: fixture.competitionId,
    clubId: club.id,
    opponentClubId: fixture.homeClubId === club.id ? fixture.awayClubId : fixture.homeClubId,
    wasHome: fixture.homeClubId === club.id,
    position: career.player.selectedPosition,
    minutes: fixture.result.playerMinutes ?? 0,
    goals: fixture.result.playerGoals ?? 0,
    assists: fixture.result.playerAssists ?? 0,
    rating: fixture.result.playerRating ?? 0,
    outcome: getFixtureOutcome(fixture, club.id) ?? "draw",
  };
}

function simulateCurrentMonth(career: CareerState): MonthSimulationResult {
  const rng = createSeededRandom(`${career.player.id}-${career.season.number}-${career.season.currentMonth}-fixtures`);
  const playerClub = getCareerClub(career);
  const monthFixtures = career.season.fixtures.filter((fixture) => fixture.month === career.season.currentMonth);
  const monthFixtureIds = new Set(monthFixtures.map((fixture) => fixture.id));
  const playedFixtures = career.season.fixtures.map((fixture) =>
    monthFixtureIds.has(fixture.id) ? simulateFixture(career, fixture, rng) : fixture,
  );
  const playerFixtures = playedFixtures.filter(
    (fixture) =>
      monthFixtureIds.has(fixture.id) &&
      fixture.leagueId === playerClub.leagueId &&
      (fixture.homeClubId === playerClub.id || fixture.awayClubId === playerClub.id),
  );
  const appearanceFixtures = playerFixtures.filter((fixture) => fixture.result?.playerAppeared);
  const ratingTotal = appearanceFixtures.reduce((total, fixture) => total + (fixture.result?.playerRating ?? 0), 0);
  const statsDelta: SeasonStats = {
    appearances: appearanceFixtures.length,
    minutesPlayed: appearanceFixtures.reduce((total, fixture) => total + (fixture.result?.playerMinutes ?? 0), 0),
    goals: appearanceFixtures.reduce((total, fixture) => total + (fixture.result?.playerGoals ?? 0), 0),
    assists: appearanceFixtures.reduce((total, fixture) => total + (fixture.result?.playerAssists ?? 0), 0),
    averageRating: appearanceFixtures.length > 0 ? round(ratingTotal / appearanceFixtures.length) : 0,
  };
  const notices: MonthlyNotice[] = [];

  if (appearanceFixtures.length > 0) {
    notices.push({
      id: `season-${career.season.number}-month-${career.season.currentMonth}-appearance`,
      month: career.season.currentMonth,
      title: "출전 기록",
      description: `${appearanceFixtures.length}경기에 출전해 ${statsDelta.goals}골 ${statsDelta.assists}도움을 기록했습니다.`,
      tone: statsDelta.averageRating >= 7 ? "success" : "info",
    });
  } else if (playerFixtures.length > 0) {
    notices.push({
      id: `season-${career.season.number}-month-${career.season.currentMonth}-bench`,
      month: career.season.currentMonth,
      title: "출전 없음",
      description: "이번 달에는 공식 경기 출전 기회를 얻지 못했습니다.",
      tone: "warning",
    });
  }

  const appearanceLogs = appearanceFixtures
    .map((fixture) => createAppearanceLog(career, fixture, playerClub))
    .filter((log): log is PlayerAppearanceLog => Boolean(log));
  const recentResults = playerFixtures
    .map((fixture) => createRecentResult(fixture, playerClub.id))
    .filter((result): result is RecentResult => Boolean(result));

  return {
    fixtures: playedFixtures,
    statsDelta,
    averageRatingFromMonth: statsDelta.averageRating,
    playingTimeShare: playerFixtures.length > 0 ? statsDelta.minutesPlayed / (playerFixtures.length * 90) : 0,
    notices,
    appearanceLogs,
    recentResults,
  };
}

function summarizeCurrentWeek(career: CareerState): MonthSimulationResult {
  const playerClub = getCareerClub(career);
  const playerFixtures = getCurrentWeekPlayerFixtures(career).filter((fixture) => fixture.status === "played");
  const appearanceFixtures = playerFixtures.filter((fixture) => fixture.result?.playerAppeared);
  const ratingTotal = appearanceFixtures.reduce((total, fixture) => total + (fixture.result?.playerRating ?? 0), 0);
  const statsDelta: SeasonStats = {
    appearances: appearanceFixtures.length,
    minutesPlayed: appearanceFixtures.reduce((total, fixture) => total + (fixture.result?.playerMinutes ?? 0), 0),
    goals: appearanceFixtures.reduce((total, fixture) => total + (fixture.result?.playerGoals ?? 0), 0),
    assists: appearanceFixtures.reduce((total, fixture) => total + (fixture.result?.playerAssists ?? 0), 0),
    averageRating: appearanceFixtures.length > 0 ? round(ratingTotal / appearanceFixtures.length) : 0,
  };
  const weekNumber =
    career.weekTurns.find((weekTurn) => weekTurn.startDate === career.currentWeekStartDate)?.weekNumber ?? 0;
  const notices: MonthlyNotice[] = [];

  if (appearanceFixtures.length > 0) {
    notices.push({
      id: `season-${career.season.number}-week-${weekNumber}-appearance`,
      month: career.season.currentMonth,
      title: "주간 출전 기록",
      description: `${appearanceFixtures.length}경기에 출전해 ${statsDelta.goals}골 ${statsDelta.assists}도움을 기록했습니다.`,
      tone: statsDelta.averageRating >= 7 ? "success" : "info",
    });
  } else if (playerFixtures.length > 0) {
    notices.push({
      id: `season-${career.season.number}-week-${weekNumber}-bench`,
      month: career.season.currentMonth,
      title: "출전 없음",
      description: "이번 주 공식 경기 출전 기회를 얻지 못했습니다.",
      tone: "warning",
    });
  }

  const appearanceLogs = appearanceFixtures
    .map((fixture) => createAppearanceLog(career, fixture, playerClub))
    .filter((log): log is PlayerAppearanceLog => Boolean(log));
  const recentResults = playerFixtures
    .map((fixture) => createRecentResult(fixture, playerClub.id))
    .filter((result): result is RecentResult => Boolean(result));

  return {
    fixtures: career.fixtures,
    statsDelta,
    averageRatingFromMonth: statsDelta.averageRating,
    playingTimeShare: playerFixtures.length > 0 ? statsDelta.minutesPlayed / (playerFixtures.length * 90) : 0,
    notices,
    appearanceLogs,
    recentResults,
  };
}

function openMatchForFixture(career: CareerState, fixture: Fixture): CareerState {
  const matchId = fixture.matchId ?? `match-${fixture.id}`;
  const inProgressFixture: Fixture = {
    ...fixture,
    matchId,
    status: "inProgress",
  };
  const competition = career.competitions[inProgressFixture.competitionId];
  const aggregateScore = getAggregateScoreBeforeFixture(career.fixtures, inProgressFixture);
  const isKnockout = inProgressFixture.playoff
    ? shouldUseKnockoutMatchState(career.fixtures, inProgressFixture)
    : competition?.type !== "league";
  const match =
    career.matches[matchId] ??
    createMatchForFixture({
      fixture: inProgressFixture,
      homeClubName: career.clubs[inProgressFixture.homeClubId]?.name ?? getClubById(inProgressFixture.homeClubId)?.name,
      awayClubName: career.clubs[inProgressFixture.awayClubId]?.name ?? getClubById(inProgressFixture.awayClubId)?.name,
      player: career.player,
      isKnockout,
      aggregateScore,
    });

  return withFixtures(
    {
      ...career,
      activeMatchId: matchId,
      matches: {
        ...career.matches,
        [matchId]: match,
      },
    },
    replaceFixture(career.fixtures, inProgressFixture),
  );
}

function processCurrentWeekUntilPlayerFixture(
  career: CareerState,
  input: AdvanceWeekInput = {},
): CareerState {
  let workingCareer = career;

  for (const fixture of getPendingCurrentWeekFixtures(workingCareer)) {
    const currentFixture = workingCareer.fixtures.find((candidate) => candidate.id === fixture.id);

    if (!currentFixture || currentFixture.status !== "scheduled") {
      continue;
    }

    if (isPlayerClubFixture(workingCareer, currentFixture)) {
      return openMatchForFixture(workingCareer, currentFixture);
    }

    const rng = createSeededRandom(`${workingCareer.player.id}-${currentFixture.id}-weekly-fixture`);
    const playedFixture = simulateFixture(workingCareer, currentFixture, rng);
    workingCareer = withFixtures(workingCareer, replaceFixture(workingCareer.fixtures, playedFixture));
  }

  return completeCurrentWeek(workingCareer, input);
}

function completeActiveMatchFromState(
  career: CareerState,
  match: Match,
  activeFixture: Fixture,
  input: AdvanceWeekInput = {},
): CareerState {
  const playedFixture: Fixture = {
    ...activeFixture,
    matchId: match.id,
    status: "played",
    result: createFixtureResultFromMatch(career, activeFixture, match),
  };
  const completedMatch: Match = {
    ...match,
    state: {
      ...match.state,
      status: "completed",
      phase: "FINISHED",
      isPaused: false,
      pauseReason: undefined,
      lastEventId: undefined,
    },
  };
  const careerAfterMatch = withFixtures(
    {
      ...career,
      activeMatchId: undefined,
      matches: {
        ...career.matches,
        [completedMatch.id]: completedMatch,
      },
    },
    replaceFixture(career.fixtures, playedFixture),
  );

  return processCurrentWeekUntilPlayerFixture(careerAfterMatch, input);
}

function updateInjury(career: CareerState, injuryRiskModifier: number, medicalSupport: number): CareerState {
  const month = career.season.currentMonth;
  const rng = createSeededRandom(`${career.player.id}-${career.season.number}-${month}-injury`);
  const nextRemaining = Math.max(0, career.injury.monthsRemaining - 1);
  const recoveredInjury =
    career.injury.severity !== "healthy" && nextRemaining === 0
      ? { severity: "healthy" as const, monthsRemaining: 0, description: undefined }
      : { ...career.injury, monthsRemaining: nextRemaining };
  const risk = clamp(career.fatigue * 0.16 + injuryRiskModifier - medicalSupport * 0.08, 1, 28);

  if (recoveredInjury.severity === "healthy" && rng() * 100 < risk) {
    const major = rng() < 0.22;

    return {
      ...career,
      injury: {
        severity: major ? "major" : "minor",
        monthsRemaining: major ? 3 : 1,
        description: major ? "근육 부상으로 몇 달간 관리가 필요합니다." : "가벼운 통증으로 출전 시간이 제한됩니다.",
      },
      notices: [
        ...career.notices,
        {
          id: `season-${career.season.number}-month-${month}-injury`,
          month,
          title: "부상 발생",
          description: major ? "중간 강도의 부상으로 회복 기간이 필요합니다." : "가벼운 부상으로 다음 달 관리가 필요합니다.",
          tone: "warning" as const,
        },
      ].slice(-20),
    };
  }

  if (career.injury.severity !== "healthy" && recoveredInjury.severity === "healthy") {
    return {
      ...career,
      injury: recoveredInjury,
      notices: [
        ...career.notices,
        {
          id: `season-${career.season.number}-month-${month}-recovered`,
          month,
          title: "부상 회복",
          description: "메디컬 팀이 정상 훈련 복귀를 허가했습니다.",
          tone: "success" as const,
        },
      ].slice(-20),
    };
  }

  return {
    ...career,
    injury: recoveredInjury,
  };
}

function completeCurrentWeek(career: CareerState, input: AdvanceWeekInput = {}): CareerState {
  const club = getCareerClub(career);
  const eventRisk = getEventInjuryRisk(career.currentEvent, input.selectedChoiceId);
  const careerAfterEvent = applyMonthlyEventChoice(career, career.currentEvent, input.selectedChoiceId);
  const careerAfterLoggedEvent = careerAfterEvent.currentEvent?.selectedChoiceId
    ? appendEventLog(
        careerAfterEvent,
        createEventLogEntry({
          career,
          type: careerAfterEvent.currentEvent.type,
          title: careerAfterEvent.currentEvent.title,
          description: careerAfterEvent.currentEvent.resolvedDescription ?? careerAfterEvent.currentEvent.description,
          idSuffix: `${careerAfterEvent.currentEvent.type}-${careerAfterEvent.currentEvent.selectedChoiceId}`,
          createdAt: input.createdAt,
          month: careerAfterEvent.currentEvent.month,
        }),
      )
    : careerAfterEvent;
  const simulated = summarizeCurrentWeek(careerAfterLoggedEvent);
  const stats: SeasonStats = {
    appearances: careerAfterLoggedEvent.seasonStats.appearances + simulated.statsDelta.appearances,
    minutesPlayed: careerAfterLoggedEvent.seasonStats.minutesPlayed + simulated.statsDelta.minutesPlayed,
    goals: careerAfterLoggedEvent.seasonStats.goals + simulated.statsDelta.goals,
    assists: careerAfterLoggedEvent.seasonStats.assists + simulated.statsDelta.assists,
    averageRating: combineAverageRating(careerAfterLoggedEvent.seasonStats, simulated.statsDelta),
  };
  const formChange = simulated.averageRatingFromMonth >= 7 ? 2 : simulated.averageRatingFromMonth > 0 ? 1 : -1;
  const coachTrustChange =
    simulated.statsDelta.appearances > 0 ? (simulated.averageRatingFromMonth >= 7 ? 2 : 1) : 0;
  const fatigueChange = Math.round(simulated.playingTimeShare * 6) - Math.round(club.trainingFacilities.medicalSupport / 48);
  const conditionChange = simulated.playingTimeShare > 0.75 ? -2 : 1;
  const transferOffer = createTransferOfferForCareer(careerAfterLoggedEvent);
  const transferOffers =
    transferOffer && !careerAfterLoggedEvent.transferOffers.some((offer) => offer.id === transferOffer.id)
      ? [...careerAfterLoggedEvent.transferOffers, transferOffer].slice(-8)
      : careerAfterLoggedEvent.transferOffers;
  const afterWeek: CareerState = {
    ...careerAfterLoggedEvent,
    seasonStats: stats,
    form: clamp(careerAfterLoggedEvent.form + formChange),
    coachTrust: clamp(careerAfterLoggedEvent.coachTrust + coachTrustChange),
    reputation: clamp(
      careerAfterLoggedEvent.reputation +
        simulated.statsDelta.goals +
        Math.round(simulated.statsDelta.assists * 0.5) +
        (simulated.averageRatingFromMonth >= 7 ? 1 : 0),
    ),
    fatigue: clamp(careerAfterLoggedEvent.fatigue + fatigueChange),
    condition: clamp(careerAfterLoggedEvent.condition + conditionChange),
    transferOffers,
    playerAppearanceLogs: [
      ...careerAfterLoggedEvent.playerAppearanceLogs,
      ...simulated.appearanceLogs,
    ].slice(-APPEARANCE_LOG_LIMIT),
    recentResults: [
      ...simulated.recentResults,
      ...careerAfterLoggedEvent.recentResults,
    ].slice(0, RECENT_RESULT_LIMIT),
    notices: [...careerAfterLoggedEvent.notices, ...simulated.notices].slice(-20),
    activeMatchId: undefined,
  };
  const afterInjury = updateInjury(afterWeek, eventRisk * 0.35, club.trainingFacilities.medicalSupport);
  const afterGrowth = applyMonthlyGrowth(afterInjury, club, {
    month: career.season.currentMonth,
    playingTimeShare: simulated.playingTimeShare,
    createdAt: input.createdAt,
  });
  const latestGrowth = afterGrowth.monthlyDevelopmentLog.at(-1);
  const growthCount = latestGrowth?.month === career.season.currentMonth ? latestGrowth.entries.length : 0;
  const weekNumber =
    career.weekTurns.find((weekTurn) => weekTurn.startDate === career.currentWeekStartDate)?.weekNumber ?? 0;
  const afterGrowthLog = appendEventLog(
    afterGrowth,
    createEventLogEntry({
      career,
      type: "weekly_summary",
      title: `${weekNumber}주차 진행 완료`,
      description: `${simulated.statsDelta.appearances}경기 출전, ${simulated.statsDelta.goals}골 ${simulated.statsDelta.assists}도움. 성장 항목 ${growthCount}개가 반영되었습니다.`,
      idSuffix: `week-${weekNumber}-summary`,
      createdAt: input.createdAt,
    }),
  );
  const nextDate = addDays(career.currentDate, 7);
  const nextMonth = new Date(nextDate).getUTCMonth() + 1;
  const nextCareer: CareerState = withSeasonCompletionState({
    ...afterGrowthLog,
    currentDate: nextDate,
    currentWeekStartDate: getWeekStartDate(nextDate),
    weekTurns: updateWeekTurnStatuses(afterGrowthLog.weekTurns, nextDate),
    season: {
      ...afterGrowthLog.season,
      currentMonth: nextMonth,
    },
    currentEvent: undefined,
  });

  if (nextCareer.season.isComplete) {
    return withUnifiedFeed(completeSeason(withSyncedPlayerMetrics(nextCareer)));
  }

  return withUnifiedFeed(
    withSyncedPlayerMetrics({
      ...nextCareer,
      currentEvent: isSameMonth(career.currentDate, nextDate) ? undefined : generateMonthlyEvent(nextCareer),
    }),
  );
}

function completeSeason(career: CareerState): CareerState {
  const tables = createTables(career.leagues, career.season.fixtures);
  const promotionRelegation = career.season.promotionRelegation?.isResolved
    ? career.season.promotionRelegation
    : progressPromotionRelegation({
        seasonNumber: career.season.number,
        seasonStartYear: career.season.year,
        leagues: career.leagues,
        tables,
        fixtures: career.season.fixtures,
        currentStatus: career.season.promotionRelegation,
        leagueMode: career.leagueMode ?? "gameplay",
      }).status;
  const club = getCareerClub(career);
  const league = career.leagues[club.leagueId];
  const leaguePosition = getClubLeaguePosition(tables[club.leagueId], club.id);
  const achievement = leaguePosition === 1 ? "리그 우승" : leaguePosition <= 3 ? "상위권 시즌" : undefined;
  const cupResults = Object.fromEntries(
    Object.values(career.clubs).map((candidate) => [
      candidate.id,
      getCupResultLabel(career.season.fixtures, candidate.id),
    ]),
  ) as Record<string, string | undefined>;
  const playerCupResult = cupResults[club.id];
  const seasonSummary = `${career.season.year} 시즌이 종료되었습니다. ${club.name}은 ${leaguePosition}위로 마쳤습니다.`;
  const historyEntry: CareerHistoryEntry = {
    id: `season-${career.season.number}-history`,
    seasonNumber: career.season.number,
    year: career.season.year,
    clubId: club.id,
    clubName: club.name,
    leagueName: league.name,
    appearances: career.seasonStats.appearances,
    goals: career.seasonStats.goals,
    assists: career.seasonStats.assists,
    averageRating: career.seasonStats.averageRating,
    leaguePosition,
    achievement: playerCupResult === "우승" ? "컵 대회 우승" : achievement,
  };
  const evolution = applyClubSeasonEvolution({
    leagues: career.leagues,
    clubs: career.clubs,
    tables,
    seasonNumber: career.season.number,
    promotionRelegation,
    cupResults,
  });
  const majorEvolutionSummary = evolution.results
    .map((result) => ({
      result,
      impact:
        Math.abs(result.newValues.reputation - result.oldValues.reputation) +
        Math.abs(result.newValues.squadStrength - result.oldValues.squadStrength),
    }))
    .filter(({ impact }) => impact >= 3)
    .sort((left, right) => right.impact - left.impact)
    .slice(0, 3)
    .map(({ result }) => {
      const evolvedClub = evolution.clubs[result.clubId];
      const reputationDelta = result.newValues.reputation - result.oldValues.reputation;
      const squadDelta = result.newValues.squadStrength - result.oldValues.squadStrength;

      return `${evolvedClub?.shortName ?? evolvedClub?.name ?? result.clubId} 평판 ${formatSignedDelta(reputationDelta)}, 전력 ${formatSignedDelta(squadDelta)}`;
    })
    .join("; ");
  const seasonSummaryWithEvolution = majorEvolutionSummary
    ? `${seasonSummary} 주요 구단 변화: ${majorEvolutionSummary}.`
    : seasonSummary;

  const completed = withSyncedPlayerMetrics({
    ...career,
    leagues: evolution.leagues,
    clubs: evolution.clubs,
    season: {
      ...career.season,
      tables,
      isComplete: true,
      promotionRelegation,
    },
    careerHistory: [...career.careerHistory, historyEntry].slice(-16),
    notices: [
      ...career.notices,
      {
        id: `season-${career.season.number}-complete`,
        month: career.season.currentMonth,
        title: "시즌 종료",
        description: `${career.season.year}시즌이 종료되었습니다. ${club.name}은 ${leaguePosition}위로 마쳤습니다.`,
        tone: "info" as const,
      },
    ].slice(-20),
  });

  return appendEventLog(
    completed,
    createEventLogEntry({
      career,
      type: "season_complete",
      title: "시즌 종료",
      description: seasonSummaryWithEvolution,
      idSuffix: "complete",
    }),
  );
}

export function createNewCareer(input: CreateMonthlyCareerInput): CareerState {
  const club = getClubById(input.clubId);

  if (!club) {
    throw new Error(`Unknown starter club: ${input.clubId}`);
  }

  const player = createPlayerFromRoll(input);
  const season = createSeason(FICTIONAL_LEAGUES, 1, 2027);
  const weekTurns = createWeekTurns(season.fixtures);
  const currentDate = weekTurns[0]?.startDate ?? getSeasonStartDate(season.year);
  const careerWithoutEvent: CareerState = {
    saveVersion: 4,
    currentDate,
    currentWeekStartDate: currentDate,
    player,
    leagues: FICTIONAL_LEAGUES,
    competitions: createFictionalCompetitions(season.number, season.fixtures),
    clubs: getClubsById(),
    fixtures: season.fixtures,
    weekTurns,
    matches: {},
    season,
    condition: 82,
    fatigue: 14,
    form: 50,
    reputation: 28,
    fanSupport: 50,
    coachTrust: 42,
    salary: 700,
    contractYearsLeft: 2,
    squadRole: "prospect",
    injury: { severity: "healthy", monthsRemaining: 0 },
    seasonStats: emptySeasonStats(),
    careerHistory: [],
    unifiedFeed: [],
    transferOffers: [],
    playerAppearanceLogs: [],
    recentResults: [],
    notices: [
      {
        id: "career-created",
        month: 1,
        title: "커리어 시작",
        description: `${club.name}에서 첫 프로 시즌을 준비합니다.`,
        tone: "success",
      },
    ],
    eventLog: [
      {
        id: "career-created",
        seasonNumber: 1,
        month: 1,
        type: "career_start",
        title: "커리어 시작",
        description: `${club.name}에서 첫 프로 시즌을 준비합니다.`,
        createdAt: new Date().toISOString(),
      },
    ],
    monthlyDevelopmentLog: [],
    archivedNonPlayableClubs: [],
    playerContractStatus: "contracted",
    leagueMode: "gameplay",
  };

  return withUnifiedFeed(
    withSyncedPlayerMetrics({
      ...careerWithoutEvent,
      currentEvent: generateMonthlyEvent(careerWithoutEvent),
    }),
  );
}

export function advanceWeek(career: CareerState, input: AdvanceWeekInput = {}): CareerState {
  if (career.playerContractStatus === "freeAgent" || career.season.isComplete || career.activeMatchId) {
    return career;
  }

  return processCurrentWeekUntilPlayerFixture(career, input);
}

export function resolveActiveMatch(career: CareerState, input: AdvanceWeekInput = {}): CareerState {
  if (!career.activeMatchId) {
    return career;
  }

  const match = career.matches[career.activeMatchId];
  const activeFixture = career.fixtures.find(
    (fixture) => fixture.matchId === career.activeMatchId || fixture.id === match?.fixtureId,
  );

  if (!match || !activeFixture) {
    return {
      ...career,
      activeMatchId: undefined,
    };
  }

  const completedMatch = fastForwardMatchToFinish(match);

  return completeActiveMatchFromState(career, completedMatch, activeFixture, input);
}

export function progressActiveMatch(
  career: CareerState,
  action: MatchAction,
  input: AdvanceWeekInput = {},
): CareerState {
  if (!career.activeMatchId) {
    return career;
  }

  const match = career.matches[career.activeMatchId];
  const activeFixture = career.fixtures.find(
    (fixture) => fixture.matchId === career.activeMatchId || fixture.id === match?.fixtureId,
  );

  if (!match || !activeFixture) {
    return {
      ...career,
      activeMatchId: undefined,
    };
  }

  const progressedMatch = isMatchReadyToFinalize(match) ? match : advanceMatch(match, action);
  const careerWithMatch = {
    ...career,
    matches: {
      ...career.matches,
      [progressedMatch.id]: progressedMatch,
    },
  };

  if (isMatchReadyToFinalize(progressedMatch)) {
    return completeActiveMatchFromState(careerWithMatch, progressedMatch, activeFixture, input);
  }

  return careerWithMatch;
}

export function advanceMonth(career: CareerState, input: AdvanceMonthInput = {}): CareerState {
  if (career.season.isComplete) {
    return career;
  }

  const club = getCareerClub(career);
  const eventRisk = getEventInjuryRisk(career.currentEvent, input.selectedChoiceId);
  const careerAfterEvent = applyMonthlyEventChoice(career, career.currentEvent, input.selectedChoiceId);
  const careerAfterLoggedEvent = careerAfterEvent.currentEvent?.selectedChoiceId
    ? appendEventLog(
        careerAfterEvent,
        createEventLogEntry({
          career,
          type: careerAfterEvent.currentEvent.type,
          title: careerAfterEvent.currentEvent.title,
          description: careerAfterEvent.currentEvent.resolvedDescription ?? careerAfterEvent.currentEvent.description,
          idSuffix: `${careerAfterEvent.currentEvent.type}-${careerAfterEvent.currentEvent.selectedChoiceId}`,
          createdAt: input.createdAt,
          month: careerAfterEvent.currentEvent.month,
        }),
      )
    : careerAfterEvent;
  const simulated = simulateCurrentMonth(careerAfterLoggedEvent);
  const stats: SeasonStats = {
    appearances: careerAfterLoggedEvent.seasonStats.appearances + simulated.statsDelta.appearances,
    minutesPlayed: careerAfterLoggedEvent.seasonStats.minutesPlayed + simulated.statsDelta.minutesPlayed,
    goals: careerAfterLoggedEvent.seasonStats.goals + simulated.statsDelta.goals,
    assists: careerAfterLoggedEvent.seasonStats.assists + simulated.statsDelta.assists,
    averageRating: combineAverageRating(careerAfterLoggedEvent.seasonStats, simulated.statsDelta),
  };
  const tables = createTables(careerAfterLoggedEvent.leagues, simulated.fixtures);
  const formChange = simulated.averageRatingFromMonth >= 7 ? 4 : simulated.averageRatingFromMonth > 0 ? 1 : -2;
  const coachTrustChange = simulated.statsDelta.appearances > 0 ? (simulated.averageRatingFromMonth >= 7 ? 3 : 1) : -1;
  const fatigueChange = Math.round(simulated.playingTimeShare * 12) - Math.round(club.trainingFacilities.medicalSupport / 24);
  const conditionChange = simulated.playingTimeShare > 0.75 ? -4 : 2;
  const transferOffer = createTransferOfferForCareer(careerAfterLoggedEvent);
  const afterMonth: CareerState = {
    ...careerAfterLoggedEvent,
    fixtures: simulated.fixtures,
    season: {
      ...careerAfterLoggedEvent.season,
      fixtures: simulated.fixtures,
      tables,
    },
    seasonStats: stats,
    form: clamp(careerAfterLoggedEvent.form + formChange),
    coachTrust: clamp(careerAfterLoggedEvent.coachTrust + coachTrustChange),
    reputation: clamp(careerAfterLoggedEvent.reputation + simulated.statsDelta.goals * 2 + simulated.statsDelta.assists + (simulated.averageRatingFromMonth >= 7 ? 2 : 0)),
    fatigue: clamp(careerAfterLoggedEvent.fatigue + fatigueChange),
    condition: clamp(careerAfterLoggedEvent.condition + conditionChange),
    transferOffers: transferOffer
      ? [...careerAfterLoggedEvent.transferOffers, transferOffer].slice(-8)
      : careerAfterLoggedEvent.transferOffers,
    playerAppearanceLogs: [
      ...careerAfterLoggedEvent.playerAppearanceLogs,
      ...simulated.appearanceLogs,
    ].slice(-APPEARANCE_LOG_LIMIT),
    recentResults: [
      ...simulated.recentResults,
      ...careerAfterLoggedEvent.recentResults,
    ].slice(0, RECENT_RESULT_LIMIT),
    notices: [...careerAfterLoggedEvent.notices, ...simulated.notices].slice(-20),
  };
  const afterInjury = updateInjury(afterMonth, eventRisk, club.trainingFacilities.medicalSupport);
  const afterGrowth = applyMonthlyGrowth(afterInjury, club, {
    month: career.season.currentMonth,
    playingTimeShare: simulated.playingTimeShare,
    createdAt: input.createdAt,
  });
  const latestGrowth = afterGrowth.monthlyDevelopmentLog.at(-1);
  const growthCount = latestGrowth?.month === career.season.currentMonth ? latestGrowth.entries.length : 0;
  const afterGrowthLog = appendEventLog(
    afterGrowth,
    createEventLogEntry({
      career,
      type: "monthly_summary",
      title: `${career.season.currentMonth}월 진행 완료`,
      description: `${simulated.statsDelta.appearances}경기 출전, ${simulated.statsDelta.goals}골 ${simulated.statsDelta.assists}도움. 성장 항목 ${growthCount}개가 반영되었습니다.`,
      idSuffix: "summary",
      createdAt: input.createdAt,
    }),
  );
  const nextMonth = career.season.currentMonth + 1;
  const nextDate = getMonthStartDate(afterGrowthLog.season.year, Math.min(nextMonth, 12));
  const nextCareer: CareerState = withSeasonCompletionState({
    ...afterGrowthLog,
    currentDate: nextDate,
    currentWeekStartDate: getWeekStartDate(nextDate),
    season: {
      ...afterGrowthLog.season,
      currentMonth: nextMonth,
    },
    currentEvent: undefined,
  });

  if (nextCareer.season.isComplete) {
    return withUnifiedFeed(completeSeason(withSyncedPlayerMetrics(nextCareer)));
  }

  return withUnifiedFeed(
    withSyncedPlayerMetrics({
      ...nextCareer,
      currentEvent: generateMonthlyEvent(nextCareer),
    }),
  );
}

function createFreeAgentOffers(career: CareerState, clubs: Record<string, Club>, leagues: Record<LeagueTier, League>): TransferOffer[] {
  const playerOverall = calculateOverall(career.player);
  const createdAt = new Date(Date.UTC(career.season.year + 1, 0, 1)).toISOString();

  return Object.values(clubs)
    .filter((club) => club.id !== career.player.clubId)
    .map((club) => ({
      club,
      fit: calculateTeamFit({
        club,
        league: leagues[club.leagueId],
        playerOverall,
        selectedPosition: career.player.selectedPosition,
      }),
    }))
    .sort((left, right) => right.fit.score - left.fit.score || right.club.reputation - left.club.reputation)
    .slice(0, 6)
    .map(({ club, fit }) => {
      const salary = Math.round((450 + playerOverall * 10 + club.reputation * 8 + fit.score * 4) / 50) * 50;
      const terms = {
        salary,
        contractYears: 2,
        signingBonus: Math.round(salary * 0.2),
        squadRole: fit.role === "starter" ? "regular" as const : fit.role === "rotation" ? "rotation" as const : "prospect" as const,
        promisedPosition: career.player.selectedPosition,
        appearanceBonus: Math.round(salary * 0.08),
        goalBonus: Math.round(salary * 0.05),
      };

      return {
        id: `free-agent-s${career.season.number + 1}-${club.id}`,
        month: 1,
        clubId: club.id,
        clubName: club.name,
        leagueId: club.leagueId,
        squadRole: terms.squadRole,
        salary,
        createdAt,
        expiresAt: new Date(Date.UTC(career.season.year + 1, 1, 1)).toISOString(),
        contractTerms: terms,
        negotiation: createInitialNegotiation(terms, createdAt),
        description: `${club.name}이 자유계약 상태인 선수에게 ${fit.role === "starter" ? "주전 경쟁" : fit.role === "rotation" ? "로테이션" : "벤치"} 역할을 제안했습니다.`,
      };
    });
}

export function startNextSeason(career: CareerState): CareerState {
  if (!career.season.isComplete) {
    throw new Error("Cannot start next season before the current season is complete.");
  }

  const rolled = applySeasonRollover({
    leagues: career.leagues,
    clubs: career.clubs,
    promotionRelegation: career.season.promotionRelegation,
    nextSeasonStartYear: career.season.year + 1,
    archivedNonPlayableClubs: career.archivedNonPlayableClubs,
    leagueMode: career.leagueMode ?? "gameplay",
  });
  const nextSeason = createSeason(rolled.leagues, career.season.number + 1, career.season.year + 1);
  const weekTurns = createWeekTurns(nextSeason.fixtures);
  const currentDate = weekTurns[0]?.startDate ?? getSeasonStartDate(nextSeason.year);
  const playerBecameFreeAgent = rolled.relegatedOutClubIds.includes(career.player.clubId);
  const freeAgentOffers = playerBecameFreeAgent
    ? createFreeAgentOffers(career, rolled.clubs, rolled.leagues)
    : [];
  const nextCareer: CareerState = {
    ...career,
    currentDate,
    currentWeekStartDate: currentDate,
    activeMatchId: undefined,
    player: {
      ...career.player,
      age: career.player.age + 1,
    },
    leagues: rolled.leagues,
    competitions: createFictionalCompetitions(nextSeason.number, nextSeason.fixtures),
    clubs: rolled.clubs,
    fixtures: nextSeason.fixtures,
    weekTurns,
    matches: {},
    season: nextSeason,
    condition: clamp(career.condition + 14, 62, 94),
    fatigue: clamp(career.fatigue - 24, 4, 36),
    form: clamp(48 + Math.round((career.form - 50) * 0.25), 38, 64),
    contractYearsLeft: Math.max(1, career.contractYearsLeft - 1),
    injury: { severity: "healthy", monthsRemaining: 0 },
    seasonStats: emptySeasonStats(),
    transferOffers: freeAgentOffers,
    recentResults: [],
    monthlyDevelopmentLog: [],
    eventLog: [
      ...career.eventLog,
      {
        id: `season-${nextSeason.number}-start-log`,
        seasonNumber: nextSeason.number,
        month: 1,
        type: "season_start" as const,
        title: "새 시즌 시작",
        description: `${nextSeason.year} 시즌 일정이 발표되었습니다.`,
        createdAt: new Date().toISOString(),
      },
      ...(playerBecameFreeAgent
        ? [{
            id: `season-${nextSeason.number}-free-agent-relegation`,
            seasonNumber: nextSeason.number,
            month: 1,
            type: "transfer_offer" as const,
            title: "자유계약 전환",
            description: "소속팀이 비활성 리그로 강등되어 자유계약 신분이 되었습니다.",
            createdAt: new Date().toISOString(),
          }]
        : []),
    ].slice(-EVENT_LOG_LIMIT),
    notices: [
      {
        id: `season-${nextSeason.number}-start`,
        month: 1,
        title: "새 시즌 시작",
        description: `${nextSeason.year}시즌 일정이 발표되었습니다.`,
        tone: "success",
      },
      ...(playerBecameFreeAgent
        ? [{
            id: `season-${nextSeason.number}-free-agent-relegation`,
            month: 1,
            title: "자유계약 전환",
            description: "소속팀이 비활성 리그로 강등되어 자유계약 신분이 되었습니다.",
            tone: "warning" as const,
          }]
        : []),
    ],
    currentEvent: undefined,
    archivedNonPlayableClubs: rolled.archivedNonPlayableClubs,
    playerContractStatus: playerBecameFreeAgent ? "freeAgent" : "contracted",
    leagueMode: career.leagueMode ?? "gameplay",
  };

  return withUnifiedFeed(
    withSyncedPlayerMetrics({
      ...nextCareer,
      currentEvent: generateMonthlyEvent(nextCareer),
    }),
  );
}

export function getRecentFixtures(career: CareerState, limit = 8): Fixture[] {
  return career.season.fixtures
    .filter((fixture) => fixture.status === "played")
    .slice()
    .reverse()
    .slice(0, limit);
}

export function getLeagueDisplayName(career: CareerState): string {
  return getLeagueName(getCareerClub(career).leagueId);
}
