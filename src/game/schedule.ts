import { CLUBS } from "../data/clubs";
import type { Club, Match } from "../domain/types";

interface ScheduleOptions {
  seasonNumber?: number;
}

function createMatchId(
  seasonNumber: number,
  week: number,
  fixtureNumber: number,
  homeClubId: string,
  awayClubId: string,
): string {
  return `s${seasonNumber}-w${week}-m${fixtureNumber}-${homeClubId}-${awayClubId}`;
}

function createScheduledMatch(
  seasonNumber: number,
  week: number,
  fixtureNumber: number,
  homeClubId: string,
  awayClubId: string,
): Match {
  return {
    id: createMatchId(seasonNumber, week, fixtureNumber, homeClubId, awayClubId),
    week,
    homeClubId,
    awayClubId,
    status: "scheduled",
    events: [],
  };
}

export function generateSeasonSchedule(
  clubs: readonly Club[] = CLUBS,
  options: ScheduleOptions = {},
): Match[] {
  if (clubs.length < 2 || clubs.length % 2 !== 0) {
    throw new Error("Season schedule requires an even number of at least two clubs.");
  }

  const seasonNumber = options.seasonNumber ?? 1;
  const fixedClubId = clubs[0].id;
  const rotatingClubIds = clubs.slice(1).map((club) => club.id);
  const firstHalf: Match[] = [];
  const rounds = clubs.length - 1;
  const fixturesPerWeek = clubs.length / 2;

  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    const week = roundIndex + 1;
    const weeklyClubIds = [fixedClubId, ...rotatingClubIds];

    for (let fixtureIndex = 0; fixtureIndex < fixturesPerWeek; fixtureIndex += 1) {
      const leftClubId = weeklyClubIds[fixtureIndex];
      const rightClubId = weeklyClubIds[weeklyClubIds.length - 1 - fixtureIndex];
      const shouldSwapHome = (roundIndex + fixtureIndex) % 2 === 1;
      const homeClubId = shouldSwapHome ? rightClubId : leftClubId;
      const awayClubId = shouldSwapHome ? leftClubId : rightClubId;

      firstHalf.push(
        createScheduledMatch(
          seasonNumber,
          week,
          fixtureIndex + 1,
          homeClubId,
          awayClubId,
        ),
      );
    }

    const lastRotatingClubId = rotatingClubIds.pop();

    if (lastRotatingClubId) {
      rotatingClubIds.unshift(lastRotatingClubId);
    }
  }

  const secondHalf = firstHalf.map((match, matchIndex) =>
    createScheduledMatch(
      seasonNumber,
      match.week + rounds,
      (matchIndex % fixturesPerWeek) + 1,
      match.awayClubId,
      match.homeClubId,
    ),
  );

  return [...firstHalf, ...secondHalf];
}
