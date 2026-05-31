import {
  FICTIONAL_LEAGUES,
  K1_LEAGUE_ID,
  K2_LEAGUE_ID,
  getAllClubs,
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
  MonthlyNotice,
  Season,
  SeasonStats,
  TransferOffer,
} from "../domain/types";
import { createPlayerFromRoll, type PlayerRoll } from "./playerGeneration";
import { calculateMarketValue, calculateOverall } from "./overall";
import { generateMonthlyEvent, applyMonthlyEventChoice, getEventInjuryRisk } from "./monthlyEvents";
import { generateLeagueFixtures, createSeasonMonths } from "./leagueSchedule";
import {
  calculateLeagueTable,
  calculatePromotionRelegationStatus,
  getClubLeaguePosition,
} from "./leagueTable";
import { applyMonthlyGrowth } from "./monthlyGrowth";
import { createSeededRandom, type RandomSource } from "./random";

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

interface MonthSimulationResult {
  fixtures: Fixture[];
  statsDelta: SeasonStats;
  averageRatingFromMonth: number;
  playingTimeShare: number;
  notices: MonthlyNotice[];
}

const EVENT_LOG_LIMIT = 80;

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
  return {
    [K1_LEAGUE_ID]: calculateLeagueTable(leagues[K1_LEAGUE_ID], fixtures),
    [K2_LEAGUE_ID]: calculateLeagueTable(leagues[K2_LEAGUE_ID], fixtures),
  };
}

function createSeason(
  leagues: Record<LeagueTier, League>,
  seasonNumber: number,
  year: number,
): Season {
  const fixtures = [
    ...generateLeagueFixtures(leagues[K1_LEAGUE_ID], { seasonNumber, totalMonths: 12 }),
    ...generateLeagueFixtures(leagues[K2_LEAGUE_ID], { seasonNumber, totalMonths: 12 }),
  ];

  return {
    id: `season-${seasonNumber}`,
    number: seasonNumber,
    year,
    currentMonth: 1,
    totalMonths: 12,
    months: createSeasonMonths(fixtures, 12),
    fixtures,
    tables: createTables(leagues, fixtures),
    isComplete: false,
  };
}

function getCareerClub(career: CareerState): Club {
  const club = getClubById(career.player.clubId);

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
      fixture.leagueId === club.leagueId &&
      (fixture.homeClubId === club.id || fixture.awayClubId === club.id),
  );
}

export function getNextPlayerFixture(career: CareerState): Fixture | undefined {
  const club = getCareerClub(career);

  return career.season.fixtures.find(
    (fixture) =>
      fixture.status === "scheduled" &&
      fixture.leagueId === club.leagueId &&
      (fixture.homeClubId === club.id || fixture.awayClubId === club.id),
  );
}

function getClubStrength(clubId: string): number {
  return getClubById(clubId)?.squadStrength ?? 58;
}

function getExpectedGoals(strength: number, rng: RandomSource, homeAdvantage = 0): number {
  const raw = 0.25 + strength / 44 + homeAdvantage + rng() * 1.25;
  return Math.max(0, Math.min(5, Math.floor(raw)));
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

  const homeStrength = getClubStrength(fixture.homeClubId);
  const awayStrength = getClubStrength(fixture.awayClubId);
  const result: FixtureResult = {
    homeGoals: getExpectedGoals(homeStrength, rng, 0.14),
    awayGoals: getExpectedGoals(awayStrength, rng),
  };
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

  return {
    ...fixture,
    status: "played",
    result,
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

  return {
    fixtures: playedFixtures,
    statsDelta,
    averageRatingFromMonth: statsDelta.averageRating,
    playingTimeShare: playerFixtures.length > 0 ? statsDelta.minutesPlayed / (playerFixtures.length * 90) : 0,
    notices,
  };
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

function createTransferOffer(career: CareerState): TransferOffer | undefined {
  const month = career.season.currentMonth;

  if (![6, 12].includes(month) || career.reputation < 42) {
    return undefined;
  }

  const currentClub = getCareerClub(career);
  const candidates = getAllClubs()
    .filter((club) => club.id !== currentClub.id)
    .filter((club) => Math.abs(club.squadStrength - calculateOverall(career.player)) <= 12)
    .sort((left, right) => right.reputation - left.reputation);
  const target = candidates[0];

  if (!target) {
    return undefined;
  }

  return {
    id: `season-${career.season.number}-month-${month}-offer-${target.id}`,
    month,
    clubId: target.id,
    clubName: target.name,
    leagueId: target.leagueId,
    squadRole: target.squadStrength <= calculateOverall(career.player) ? "regular" : "rotation",
    salary: Math.round((650 + career.reputation * 18 + calculateOverall(career.player) * 12) / 50) * 50,
    description: `${target.name}이 다음 이적 시장에서 관심을 보이고 있습니다.`,
  };
}

function completeSeason(career: CareerState): CareerState {
  const tables = createTables(career.leagues, career.season.fixtures);
  const club = getCareerClub(career);
  const league = career.leagues[club.leagueId];
  const leaguePosition = getClubLeaguePosition(tables[club.leagueId], club.id);
  const achievement = leaguePosition === 1 ? "리그 우승" : leaguePosition <= 3 ? "상위권 시즌" : undefined;
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
    achievement,
  };

  const completed = withSyncedPlayerMetrics({
    ...career,
    season: {
      ...career.season,
      tables,
      isComplete: true,
      promotionRelegation: calculatePromotionRelegationStatus(
        tables[K1_LEAGUE_ID],
        tables[K2_LEAGUE_ID],
      ),
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
      description: seasonSummary,
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
  const careerWithoutEvent: CareerState = {
    saveVersion: 2,
    player,
    leagues: FICTIONAL_LEAGUES,
    season,
    condition: 82,
    fatigue: 14,
    form: 50,
    reputation: 28,
    coachTrust: 42,
    salary: 700,
    contractYearsLeft: 2,
    squadRole: "prospect",
    injury: { severity: "healthy", monthsRemaining: 0 },
    seasonStats: emptySeasonStats(),
    careerHistory: [],
    transferOffers: [],
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
  };

  return withSyncedPlayerMetrics({
    ...careerWithoutEvent,
    currentEvent: generateMonthlyEvent(careerWithoutEvent),
  });
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
  const transferOffer = createTransferOffer(careerAfterLoggedEvent);
  const afterMonth: CareerState = {
    ...careerAfterLoggedEvent,
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
  const nextCareer: CareerState = {
    ...afterGrowthLog,
    season: {
      ...afterGrowthLog.season,
      currentMonth: nextMonth,
      isComplete: nextMonth > afterGrowthLog.season.totalMonths,
    },
    currentEvent: undefined,
  };

  if (nextCareer.season.isComplete) {
    return completeSeason(withSyncedPlayerMetrics(nextCareer));
  }

  return withSyncedPlayerMetrics({
    ...nextCareer,
    currentEvent: generateMonthlyEvent(nextCareer),
  });
}

export function startNextSeason(career: CareerState): CareerState {
  if (!career.season.isComplete) {
    throw new Error("Cannot start next season before the current season is complete.");
  }

  const nextSeason = createSeason(career.leagues, career.season.number + 1, career.season.year + 1);
  const nextCareer: CareerState = {
    ...career,
    player: {
      ...career.player,
      age: career.player.age + 1,
    },
    season: nextSeason,
    condition: clamp(career.condition + 14, 62, 94),
    fatigue: clamp(career.fatigue - 24, 4, 36),
    form: clamp(48 + Math.round((career.form - 50) * 0.25), 38, 64),
    contractYearsLeft: Math.max(1, career.contractYearsLeft - 1),
    injury: { severity: "healthy", monthsRemaining: 0 },
    seasonStats: emptySeasonStats(),
    transferOffers: [],
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
    ].slice(-EVENT_LOG_LIMIT),
    notices: [
      {
        id: `season-${nextSeason.number}-start`,
        month: 1,
        title: "새 시즌 시작",
        description: `${nextSeason.year}시즌 일정이 발표되었습니다.`,
        tone: "success",
      },
    ],
    currentEvent: undefined,
  };

  return withSyncedPlayerMetrics({
    ...nextCareer,
    currentEvent: generateMonthlyEvent(nextCareer),
  });
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
