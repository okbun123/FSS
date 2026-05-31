import { deriveDominantFoot } from "../domain/player";
import {
  FICTIONAL_LEAGUES,
  createFictionalCompetitions,
  getClubById,
  getClubsById,
} from "../data/fictionalLeagues";
import { getLeagueRuleSetsForSeason } from "../domain/leagueRules";
import type {
  CareerState,
  ContractTerms,
  Fixture,
  LeagueTier,
  Match,
  MatchPhase,
  TransferOffer,
} from "../domain/types";
import { createMatchForFixture } from "../domain/matchStateMachine";
import { createSeasonMonths, createWeekTurns, generateLeagueFixtures, getDefaultLeagueSeasonStartDate } from "../game/leagueSchedule";
import { calculateMarketValue, calculateOverall } from "../game/overall";
import { calculatePositionRecommendations } from "../game/positionRecommendation";
import { createUnifiedFeedForCareer } from "../domain/feed";
import { createInitialDomesticCupFixtures } from "../domain/domesticCup";
import { calculateLeagueTable } from "../game/leagueTable";

export const CAREER_SAVE_KEY = "football-career-sim.career-state";
export const CURRENT_SAVE_VERSION = 4;
export const INCOMPATIBLE_SAVE_MESSAGE =
  "이전 저장 데이터는 새 리그/경기 시스템과 호환되지 않아 초기화가 필요합니다.";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CareerSaveFile {
  saveVersion: number;
  savedAt: string;
  careerState: CareerState;
}

export type CareerSaveLoadResult =
  | { status: "empty" }
  | { status: "loaded"; save: CareerSaveFile }
  | { status: "invalid"; message: string }
  | { status: "unsupportedVersion"; message: string; foundVersion: number };

function getBrowserStorage(): StorageLike | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  return localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValidCareerShape(value: unknown): value is CareerState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isRecord(value.player) &&
    typeof value.player.name === "string" &&
    typeof value.player.leftFoot === "number" &&
    typeof value.player.rightFoot === "number" &&
    isRecord(value.player.attributes) &&
    isRecord(value.season) &&
    typeof value.season.currentMonth === "number" &&
    Array.isArray(value.season.fixtures) &&
    isRecord(value.leagues)
  );
}

function isoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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

function getFixtureDate(year: number, round: number): string {
  return addDays(new Date(getDefaultLeagueSeasonStartDate(year)), (round - 1) * 7).toISOString();
}

function normalizeFixture(fixture: Fixture, seasonYear: number): Fixture {
  const date = fixture.date ?? getFixtureDate(seasonYear, fixture.round);
  const league = FICTIONAL_LEAGUES[fixture.leagueId];

  return {
    ...fixture,
    competitionId: fixture.competitionId ?? league.competitionId,
    date,
    weekNumber: fixture.weekNumber ?? fixture.round,
    month: fixture.month ?? new Date(date).getUTCMonth() + 1,
  };
}

function createFallbackContractTerms(offer: TransferOffer): ContractTerms {
  return {
    salary: offer.salary,
    contractYears: 3,
    signingBonus: Math.round(offer.salary * 0.35),
    squadRole: offer.squadRole,
    appearanceBonus: Math.round(offer.salary * 0.08),
    goalBonus: Math.round(offer.salary * 0.05),
  };
}

function normalizeTransferOffer(offer: TransferOffer, seasonYear: number): TransferOffer {
  const createdAt = offer.createdAt ?? getMonthStartDate(seasonYear, offer.month);
  const contractTerms = offer.contractTerms ?? createFallbackContractTerms(offer);
  const currentTerms = {
    ...contractTerms,
    ...(offer.negotiation?.currentTerms ?? {}),
  };

  return {
    ...offer,
    salary: currentTerms.salary,
    squadRole: currentTerms.squadRole,
    createdAt,
    expiresAt: offer.expiresAt ?? getMonthStartDate(seasonYear, Math.min(offer.month + 1, 12)),
    contractTerms: currentTerms,
    negotiation: {
      status: offer.negotiation?.status ?? "open",
      round: offer.negotiation?.round ?? 0,
      maxRounds: offer.negotiation?.maxRounds ?? 3,
      currentTerms,
      playerCounterTerms: offer.negotiation?.playerCounterTerms,
      lastResponse: offer.negotiation?.lastResponse ?? "waiting",
      updatedAt: offer.negotiation?.updatedAt ?? createdAt,
    },
  };
}

const MATCH_PHASE_MIGRATIONS: Record<string, MatchPhase> = {
  preMatch: "PRE_MATCH",
  firstHalf: "FIRST_HALF",
  halfTime: "HALF_TIME",
  secondHalf: "SECOND_HALF",
  fullTime: "FULL_TIME",
  extraTimeFirstHalf: "EXTRA_TIME_FIRST_HALF",
  extraTimeHalfTime: "EXTRA_TIME_HALF_TIME",
  extraTimeSecondHalf: "EXTRA_TIME_SECOND_HALF",
  penaltyShootout: "PENALTY_SHOOTOUT",
};

function normalizeMatchPhase(phase: unknown): MatchPhase {
  if (typeof phase === "string" && phase in MATCH_PHASE_MIGRATIONS) {
    return MATCH_PHASE_MIGRATIONS[phase];
  }

  return typeof phase === "string" ? (phase as MatchPhase) : "PRE_MATCH";
}

function normalizeMatch(
  match: Match,
  fixtures: readonly Fixture[],
  player: CareerState["player"],
): Match {
  const fixture = fixtures.find((candidate) => candidate.matchId === match.id || candidate.id === match.fixtureId);
  const existingLineups = match.lineups;
  const existingState = match.state;
  const needsLineup =
    !existingLineups?.home?.starters?.length ||
    !existingLineups?.away?.starters?.length;
  const baseMatch =
    fixture && needsLineup
      ? createMatchForFixture({
          fixture: {
            ...fixture,
            matchId: match.id,
          },
          player,
        })
      : match;

  return {
    ...baseMatch,
    ...match,
    state: {
      ...baseMatch.state,
      ...existingState,
      phase: normalizeMatchPhase(existingState?.phase),
      nextEventIndex: existingState?.nextEventIndex ?? 0,
      isPaused: existingState?.isPaused ?? false,
    },
    lineups: {
      home: {
        ...baseMatch.lineups.home,
        ...existingLineups?.home,
        starters: (needsLineup ? baseMatch.lineups.home.starters : existingLineups.home.starters).map((matchPlayer) => ({
          ...matchPlayer,
          injured: matchPlayer.injured ?? false,
          status: matchPlayer.status ?? (matchPlayer.redCard ? "sentOff" : "onPitch"),
        })),
        substitutes: (needsLineup ? baseMatch.lineups.home.substitutes : existingLineups.home.substitutes).map((matchPlayer) => ({
          ...matchPlayer,
          injured: matchPlayer.injured ?? false,
          status: matchPlayer.status ?? (matchPlayer.redCard ? "sentOff" : "available"),
        })),
      },
      away: {
        ...baseMatch.lineups.away,
        ...existingLineups?.away,
        starters: (needsLineup ? baseMatch.lineups.away.starters : existingLineups.away.starters).map((matchPlayer) => ({
          ...matchPlayer,
          injured: matchPlayer.injured ?? false,
          status: matchPlayer.status ?? (matchPlayer.redCard ? "sentOff" : "onPitch"),
        })),
        substitutes: (needsLineup ? baseMatch.lineups.away.substitutes : existingLineups.away.substitutes).map((matchPlayer) => ({
          ...matchPlayer,
          injured: matchPlayer.injured ?? false,
          status: matchPlayer.status ?? (matchPlayer.redCard ? "sentOff" : "available"),
        })),
      },
    },
    events: (match.events ?? []).map((event) => ({
      ...event,
      phase: normalizeMatchPhase(event.phase),
    })),
    scriptedEvents: match.scriptedEvents?.map((event) => ({
      ...event,
      phase: normalizeMatchPhase(event.phase),
    })),
  };
}

function hasPlayedFixtures(fixtures: readonly Fixture[]): boolean {
  return fixtures.some((fixture) => fixture.status === "played" || fixture.status === "inProgress");
}

function createFullSeasonFixtures(seasonNumber: number, seasonYear: number): Fixture[] {
  const seasonStartDate = getDefaultLeagueSeasonStartDate(seasonYear);
  return [
    ...Object.values(FICTIONAL_LEAGUES).flatMap((league) =>
      generateLeagueFixtures(league, { seasonNumber, totalMonths: 12, seasonStartDate }),
    ),
    ...createInitialDomesticCupFixtures({
      clubs: Object.values(FICTIONAL_LEAGUES).flatMap((league) => league.clubs),
      seasonNumber,
      seasonYear,
    }),
  ].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.round - right.round ||
      left.id.localeCompare(right.id),
  );
}

function createTables(leagues: CareerState["leagues"], fixtures: readonly Fixture[]) {
  return Object.fromEntries(
    Object.entries(leagues).map(([leagueId, league]) => [
      leagueId,
      calculateLeagueTable(league, fixtures),
    ]),
  ) as CareerState["season"]["tables"];
}

function normalizeCareerState(careerState: CareerState): CareerState {
  const seasonYear = careerState.season.year ?? 2027;
  const seasonNumber = careerState.season.number ?? 1;
  const existingSeasonFixtures = (careerState.season.fixtures ?? []).map((fixture) =>
    normalizeFixture(fixture, seasonYear),
  );
  const shouldRegenerateSeason = !hasPlayedFixtures(existingSeasonFixtures) && careerState.saveVersion < CURRENT_SAVE_VERSION;
  const seasonFixtures = shouldRegenerateSeason
    ? createFullSeasonFixtures(seasonNumber, seasonYear)
    : existingSeasonFixtures;
  const transferOffers = (careerState.transferOffers ?? []).map((offer) =>
    normalizeTransferOffer(offer, seasonYear),
  );
  const notices = careerState.notices ?? [];
  const eventLog = careerState.eventLog ?? [];
  const selectedPosition = careerState.player.selectedPosition ?? careerState.player.position ?? "ST";
  const form = careerState.form ?? careerState.player.form ?? 50;
  const condition = careerState.condition ?? careerState.player.condition ?? 80;
  const fatigue = careerState.fatigue ?? careerState.player.fatigue ?? 10;
  const reputation = careerState.reputation ?? careerState.player.reputation ?? 25;
  const coachTrust = careerState.coachTrust ?? careerState.player.coachTrust ?? 40;
  const playerBase = {
    ...careerState.player,
    selectedPosition,
    position: selectedPosition,
    recommendedPositions:
      careerState.player.recommendedPositions ??
      calculatePositionRecommendations({
        attributes: careerState.player.attributes,
        leftFoot: careerState.player.leftFoot,
        rightFoot: careerState.player.rightFoot,
        potential: careerState.player.potential,
      }),
    dominantFoot:
      careerState.player.dominantFoot ??
      deriveDominantFoot(careerState.player.leftFoot, careerState.player.rightFoot),
    form,
    condition,
    fatigue,
    reputation,
    coachTrust,
  };
  const OVR = calculateOverall(playerBase, selectedPosition);
  const player = {
    ...playerBase,
    OVR,
    marketValue: careerState.player.marketValue ?? calculateMarketValue({ ...playerBase, OVR }, reputation),
  };
  const fixtures = shouldRegenerateSeason
    ? seasonFixtures
    : careerState.fixtures?.map((fixture) => normalizeFixture(fixture, seasonYear)) ?? seasonFixtures;
  const matches = Object.fromEntries(
    Object.entries(careerState.matches ?? {}).map(([matchId, match]) => [
      matchId,
      normalizeMatch(match, fixtures, player),
    ]),
  );
  const ruleSets = getLeagueRuleSetsForSeason(seasonYear);
  const clubs = {
    ...getClubsById(),
    ...(careerState.clubs ?? {}),
  };
  const leagueIds = Object.keys(FICTIONAL_LEAGUES) as LeagueTier[];
  const leagues = Object.fromEntries(
    leagueIds.map((leagueId) => [
      leagueId,
      {
        ...(careerState.leagues?.[leagueId] ?? FICTIONAL_LEAGUES[leagueId]),
        ruleSet: ruleSets[leagueId],
        clubs: Object.values(clubs).filter((club) => club.leagueId === leagueId),
      },
    ]),
  ) as CareerState["leagues"];
  const weekTurns = shouldRegenerateSeason ? createWeekTurns(fixtures) : careerState.weekTurns ?? createWeekTurns(fixtures);
  const currentDate =
    shouldRegenerateSeason
      ? weekTurns[0]?.startDate ?? getMonthStartDate(seasonYear, 1)
      : careerState.currentDate ?? weekTurns[0]?.startDate ?? getMonthStartDate(seasonYear, careerState.season.currentMonth ?? 1);
  const currentWeekStartDate = shouldRegenerateSeason
    ? currentDate
    : careerState.currentWeekStartDate ?? getWeekStartDate(currentDate);
  const season = {
    ...careerState.season,
    number: seasonNumber,
    year: seasonYear,
    currentMonth: shouldRegenerateSeason ? new Date(currentDate).getUTCMonth() + 1 : careerState.season.currentMonth,
    fixtures,
    months: createSeasonMonths(fixtures, careerState.season.totalMonths ?? 12),
    tables: createTables(leagues, fixtures),
  };

  const normalizedCareer: CareerState = {
    ...careerState,
    saveVersion: CURRENT_SAVE_VERSION,
    currentDate,
    currentWeekStartDate,
    activeMatchId: careerState.activeMatchId,
    player,
    leagues,
    competitions:
      shouldRegenerateSeason || !careerState.competitions
        ? createFictionalCompetitions(seasonNumber, fixtures)
        : careerState.competitions,
    clubs,
    fixtures,
    weekTurns,
    matches,
    season,
    archivedNonPlayableClubs: careerState.archivedNonPlayableClubs ?? [],
    playerContractStatus: careerState.playerContractStatus ?? "contracted",
    leagueMode: careerState.leagueMode ?? "gameplay",
    form,
    condition,
    fatigue,
    reputation,
    fanSupport: careerState.fanSupport ?? 50,
    coachTrust,
    careerHistory: careerState.careerHistory ?? [],
    unifiedFeed: [],
    transferOffers,
    playerAppearanceLogs: careerState.playerAppearanceLogs ?? [],
    recentResults: careerState.recentResults ?? [],
    notices,
    eventLog,
    monthlyDevelopmentLog: careerState.monthlyDevelopmentLog ?? [],
    injury: careerState.injury ?? { severity: "healthy", monthsRemaining: 0 },
  };

  return {
    ...normalizedCareer,
    unifiedFeed: createUnifiedFeedForCareer(normalizedCareer),
  };
}

function parseSaveFile(value: unknown): CareerSaveLoadResult {
  if (!isRecord(value)) {
    return {
      status: "invalid",
      message: "저장 데이터를 읽을 수 없습니다. 저장을 삭제하고 새 커리어를 시작해 주세요.",
    };
  }

  if (typeof value.saveVersion !== "number") {
    return {
      status: "invalid",
      message: INCOMPATIBLE_SAVE_MESSAGE,
    };
  }

  if (![2, 3, CURRENT_SAVE_VERSION].includes(value.saveVersion)) {
    return {
      status: "unsupportedVersion",
      foundVersion: value.saveVersion,
      message: INCOMPATIBLE_SAVE_MESSAGE,
    };
  }

  if (typeof value.savedAt !== "string" || !hasValidCareerShape(value.careerState)) {
    return {
      status: "invalid",
      message: "저장 데이터가 손상되었습니다. 저장을 삭제하고 새 커리어를 시작해 주세요.",
    };
  }

  const savedClubs = isRecord(value.careerState.clubs) ? value.careerState.clubs : {};
  const playerClubId = value.careerState.player.clubId;

  if (typeof playerClubId !== "string" || (!getClubById(playerClubId) && !isRecord(savedClubs[playerClubId]))) {
    return {
      status: "unsupportedVersion",
      foundVersion: value.saveVersion,
      message: INCOMPATIBLE_SAVE_MESSAGE,
    };
  }

  return {
    status: "loaded",
    save: {
      saveVersion: CURRENT_SAVE_VERSION,
      savedAt: value.savedAt,
      careerState: normalizeCareerState(value.careerState),
    },
  };
}

export function createCareerSaveFile(
  careerState: CareerState,
  savedAt: Date = new Date(),
): CareerSaveFile {
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    savedAt: savedAt.toISOString(),
    careerState: normalizeCareerState(careerState),
  };
}

export function loadCareerSave(storage: StorageLike | null = getBrowserStorage()): CareerSaveLoadResult {
  if (!storage) {
    return { status: "empty" };
  }

  const storedCareer = storage.getItem(CAREER_SAVE_KEY);

  if (!storedCareer) {
    return { status: "empty" };
  }

  try {
    return parseSaveFile(JSON.parse(storedCareer) as unknown);
  } catch {
    return {
      status: "invalid",
      message: "저장 데이터를 읽을 수 없습니다. 저장을 삭제하고 새 커리어를 시작해 주세요.",
    };
  }
}

export function saveCareerState(
  careerState: CareerState,
  storage: StorageLike | null = getBrowserStorage(),
  savedAt: Date = new Date(),
): CareerSaveFile {
  if (!storage) {
    throw new Error("Local storage is not available.");
  }

  const saveFile = createCareerSaveFile(careerState, savedAt);
  storage.setItem(CAREER_SAVE_KEY, JSON.stringify(saveFile));
  return saveFile;
}

export function clearSavedCareerState(storage: StorageLike | null = getBrowserStorage()): void {
  storage?.removeItem(CAREER_SAVE_KEY);
}
