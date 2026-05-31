import { DEFAULT_LEAGUE } from "../data/clubs";
import { WEEKLY_ACTIONS } from "../data/weeklyActions";
import { createPlayerProfile, type PlayerCreationInput } from "../domain/player";
import type { CareerState, CareerWeek, Season } from "../domain/types";
import { generateSeasonSchedule } from "./schedule";
import { createEmptySeasonStats, createSeasonBaseline } from "./season";

export type CreateCareerInput = PlayerCreationInput;

export function createNewCareer(input: CreateCareerInput): CareerState {
  const clubExists = DEFAULT_LEAGUE.clubs.some((club) => club.id === input.clubId);

  if (!clubExists) {
    throw new Error(`Unknown starter club: ${input.clubId}`);
  }

  const seasonNumber = 1;
  const matches = generateSeasonSchedule(DEFAULT_LEAGUE.clubs, { seasonNumber });
  const season: Season = {
    id: `season-${seasonNumber}`,
    number: seasonNumber,
    leagueId: DEFAULT_LEAGUE.id,
    currentWeek: 1,
    totalWeeks: DEFAULT_LEAGUE.seasonWeeks,
    matches,
    isComplete: false,
  };
  const player = createPlayerProfile(input);
  const initialCareerBase = {
    season,
    player,
    league: DEFAULT_LEAGUE,
    coachTrust: 45,
    fanSupport: 35,
    reputation: 30,
  };

  return {
    saveVersion: 1,
    player,
    league: DEFAULT_LEAGUE,
    season,
    currentWeek: 1,
    condition: 82,
    fatigue: 12,
    form: 50,
    coachTrust: 45,
    fanSupport: 35,
    reputation: 30,
    tacticalFit: 42,
    salary: 900,
    contractYearsLeft: 2,
    squadRole: "prospect",
    weeklyActionCompleted: false,
    seasonStats: createEmptySeasonStats(),
    availableWeeklyActions: WEEKLY_ACTIONS,
    eventLog: [
      {
        id: `season-${seasonNumber}-week-1-created`,
        week: 1,
        title: "커리어 시작",
        description: "첫 프로 시즌이 시작되었습니다.",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    developmentLog: [],
    seasonBaseline: createSeasonBaseline(initialCareerBase),
    careerHistory: [],
    seasonOffers: [],
    rejectedContractOfferIds: [],
  };
}

export function getCurrentWeek(career: CareerState): CareerWeek {
  const isSeasonComplete = career.currentWeek > career.season.totalWeeks;
  const matches = isSeasonComplete
    ? []
    : career.season.matches.filter((match) => match.week === career.currentWeek);
  const playerMatch = matches.find(
    (match) =>
      match.homeClubId === career.player.clubId || match.awayClubId === career.player.clubId,
  );

  return {
    week: career.currentWeek,
    matches,
    playerMatch,
    isSeasonComplete,
  };
}

export function advanceWeek(career: CareerState): CareerState {
  const nextWeek = Math.min(career.currentWeek + 1, career.season.totalWeeks + 1);
  const isComplete = nextWeek > career.season.totalWeeks;

  return {
    ...career,
    currentWeek: nextWeek,
    season: {
      ...career.season,
      currentWeek: nextWeek,
      isComplete,
    },
    weeklyActionCompleted: false,
  };
}
