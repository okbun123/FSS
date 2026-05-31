import type { Club, Fixture, League, SeasonMonth } from "../domain/types";

interface ScheduleOptions {
  seasonNumber?: number;
  totalMonths?: number;
}

const MONTH_LABELS = [
  "1월",
  "2월",
  "3월",
  "4월",
  "5월",
  "6월",
  "7월",
  "8월",
  "9월",
  "10월",
  "11월",
  "12월",
];

function createFixtureId(
  leagueId: string,
  seasonNumber: number,
  round: number,
  fixtureNumber: number,
  homeClubId: string,
  awayClubId: string,
): string {
  return `${leagueId}-s${seasonNumber}-r${round}-m${fixtureNumber}-${homeClubId}-${awayClubId}`;
}

function createFixture(
  league: League,
  seasonNumber: number,
  round: number,
  totalRounds: number,
  fixtureNumber: number,
  homeClubId: string,
  awayClubId: string,
  totalMonths: number,
): Fixture {
  const month = Math.min(totalMonths, Math.max(1, Math.floor(((round - 1) / totalRounds) * totalMonths) + 1));

  return {
    id: createFixtureId(league.id, seasonNumber, round, fixtureNumber, homeClubId, awayClubId),
    leagueId: league.id,
    seasonNumber,
    round,
    month,
    homeClubId,
    awayClubId,
    status: "scheduled",
  };
}

function createSingleRoundRobin(clubIds: string[]): Array<Array<[string, string]>> {
  const hasBye = clubIds.length % 2 === 1;
  const ids = hasBye ? [...clubIds, "__bye__"] : [...clubIds];
  const fixed = ids[0];
  const rotating = ids.slice(1);
  const rounds: Array<Array<[string, string]>> = [];
  const fixturesPerRound = ids.length / 2;

  for (let roundIndex = 0; roundIndex < ids.length - 1; roundIndex += 1) {
    const roundIds = [fixed, ...rotating];
    const pairings: Array<[string, string]> = [];

    for (let fixtureIndex = 0; fixtureIndex < fixturesPerRound; fixtureIndex += 1) {
      const left = roundIds[fixtureIndex];
      const right = roundIds[roundIds.length - 1 - fixtureIndex];

      if (left !== "__bye__" && right !== "__bye__") {
        pairings.push((roundIndex + fixtureIndex) % 2 === 0 ? [left, right] : [right, left]);
      }
    }

    rounds.push(pairings);

    const last = rotating.pop();
    if (last) {
      rotating.unshift(last);
    }
  }

  return rounds;
}

function repeatRoundRobin(clubs: readonly Club[], cycles: number): Array<Array<[string, string]>> {
  const baseRounds = createSingleRoundRobin(clubs.map((club) => club.id));
  const rounds: Array<Array<[string, string]>> = [];

  for (let cycle = 0; cycle < cycles; cycle += 1) {
    for (const round of baseRounds) {
      rounds.push(
        round.map(([home, away], index) => {
          if (cycle % 2 === 1) {
            return [away, home];
          }
          if (cycle === 2 && index % 2 === 1) {
            return [away, home];
          }
          return [home, away];
        }),
      );
    }
  }

  return rounds;
}

export function generateLeagueFixtures(
  league: League,
  options: ScheduleOptions = {},
): Fixture[] {
  const seasonNumber = options.seasonNumber ?? 1;
  const totalMonths = options.totalMonths ?? 12;
  const cycles = league.id === "k1_fictional" ? 3 : 2;
  const rounds = repeatRoundRobin(league.clubs, cycles);
  const totalRounds = rounds.length;

  return rounds.flatMap((round, roundIndex) =>
    round.map(([homeClubId, awayClubId], fixtureIndex) =>
      createFixture(
        league,
        seasonNumber,
        roundIndex + 1,
        totalRounds,
        fixtureIndex + 1,
        homeClubId,
        awayClubId,
        totalMonths,
      ),
    ),
  );
}

export function createSeasonMonths(fixtures: readonly Fixture[], totalMonths = 12): SeasonMonth[] {
  return Array.from({ length: totalMonths }, (_, index) => {
    const month = index + 1;

    return {
      month,
      label: MONTH_LABELS[index] ?? `${month}월`,
      fixtureIds: fixtures.filter((fixture) => fixture.month === month).map((fixture) => fixture.id),
    };
  });
}
