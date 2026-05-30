import { DEFAULT_LEAGUE } from "../data/clubs";
import { WEEKLY_ACTIONS } from "../data/weeklyActions";
import { createPlayerProfile, type PlayerCreationInput } from "../domain/player";
import type { CareerState, CareerWeek, Season, SeasonStats } from "../domain/types";
import { generateSeasonSchedule } from "./schedule";

export type CreateCareerInput = PlayerCreationInput;

function createInitialSeasonStats(): SeasonStats {
  return {
    appearances: 0,
    goals: 0,
    assists: 0,
    averageRating: 0,
    keyMomentsWon: 0,
  };
}

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

  return {
    saveVersion: 1,
    player: createPlayerProfile(input),
    league: DEFAULT_LEAGUE,
    season,
    currentWeek: 1,
    condition: 82,
    fatigue: 12,
    form: 50,
    coachTrust: 45,
    fanSupport: 35,
    reputation: 30,
    seasonStats: createInitialSeasonStats(),
    availableWeeklyActions: WEEKLY_ACTIONS,
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
  };
}
