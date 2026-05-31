import {
  DOMESTIC_CUP_COMPETITION_ID,
  K1_LEAGUE_ID,
} from "../data/fictionalLeagues";
import type { Club, Fixture, FixtureResult, LeagueTier } from "./types";

export const DOMESTIC_CUP_ROUNDS = [
  { round: 1, size: 64, label: "64강", month: 4, day: 7 },
  { round: 2, size: 32, label: "32강", month: 5, day: 5 },
  { round: 3, size: 16, label: "16강", month: 6, day: 2 },
  { round: 4, size: 8, label: "8강", month: 7, day: 7 },
  { round: 5, size: 4, label: "4강", month: 8, day: 11 },
  { round: 6, size: 2, label: "결승", month: 10, day: 3 },
] as const;

function isoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day, 11, 0, 0, 0)).toISOString();
}

function fixtureDate(seasonYear: number, round: number): string {
  const config = DOMESTIC_CUP_ROUNDS.find((candidate) => candidate.round === round) ?? DOMESTIC_CUP_ROUNDS[0];
  return isoDate(seasonYear, config.month, config.day);
}

function fixtureMonth(dateIso: string): number {
  return new Date(dateIso).getUTCMonth() + 1;
}

function cupFixture(input: {
  seasonNumber: number;
  seasonYear: number;
  round: number;
  fixtureNumber: number;
  homeClubId: string;
  awayClubId: string;
  leagueId?: LeagueTier;
}): Fixture {
  const date = fixtureDate(input.seasonYear, input.round);

  return {
    id: `korea-challenge-cup-s${input.seasonNumber}-r${input.round}-m${input.fixtureNumber}-${input.homeClubId}-${input.awayClubId}`,
    leagueId: input.leagueId ?? K1_LEAGUE_ID,
    competitionId: DOMESTIC_CUP_COMPETITION_ID,
    seasonNumber: input.seasonNumber,
    round: input.round,
    month: fixtureMonth(date),
    date,
    weekNumber: 100 + input.round,
    homeClubId: input.homeClubId,
    awayClubId: input.awayClubId,
    status: "scheduled",
  };
}

export function isDomesticCupFixture(fixture: Pick<Fixture, "competitionId">): boolean {
  return fixture.competitionId === DOMESTIC_CUP_COMPETITION_ID;
}

function seededEntrants(clubs: readonly Club[]): Club[] {
  return [...clubs].sort(
    (left, right) =>
      left.leagueId.localeCompare(right.leagueId) ||
      right.reputation - left.reputation ||
      left.name.localeCompare(right.name, "ko"),
  );
}

export function createInitialDomesticCupFixtures(input: {
  clubs: readonly Club[];
  seasonNumber: number;
  seasonYear: number;
}): Fixture[] {
  const entrants = seededEntrants(input.clubs).slice(0, 64);

  if (entrants.length < 2) {
    return [];
  }

  const pairings: Array<[Club, Club]> = [];
  for (let index = 0; index < entrants.length / 2; index += 1) {
    pairings.push([entrants[index], entrants[entrants.length - 1 - index]]);
  }

  return pairings.map(([home, away], index) =>
    cupFixture({
      seasonNumber: input.seasonNumber,
      seasonYear: input.seasonYear,
      round: 1,
      fixtureNumber: index + 1,
      homeClubId: home.id,
      awayClubId: away.id,
      leagueId: home.leagueId,
    }),
  );
}

function scoreWinner(fixture: Fixture): string | undefined {
  if (!fixture.result) {
    return undefined;
  }

  if (fixture.result.winnerClubId) {
    return fixture.result.winnerClubId;
  }
  if (fixture.result.homeGoals > fixture.result.awayGoals) {
    return fixture.homeClubId;
  }
  if (fixture.result.awayGoals > fixture.result.homeGoals) {
    return fixture.awayClubId;
  }
  return undefined;
}

export function ensureCupWinner(
  fixture: Fixture,
  result: FixtureResult,
  rng: () => number,
): FixtureResult {
  if (!isDomesticCupFixture(fixture) || result.homeGoals !== result.awayGoals || result.winnerClubId) {
    return result;
  }

  if (rng() < 0.45) {
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

export function progressDomesticCupFixtures(input: {
  fixtures: readonly Fixture[];
  clubsById: Record<string, Club>;
  seasonNumber: number;
  seasonYear: number;
}): Fixture[] {
  let fixtures = [...input.fixtures];

  for (const roundConfig of DOMESTIC_CUP_ROUNDS) {
    const roundFixtures = fixtures.filter(
      (fixture) => isDomesticCupFixture(fixture) && fixture.round === roundConfig.round,
    );

    if (roundFixtures.length === 0 || roundFixtures.some((fixture) => fixture.status !== "played" || !fixture.result)) {
      return fixtures;
    }

    const nextRound = DOMESTIC_CUP_ROUNDS.find((candidate) => candidate.round === roundConfig.round + 1);
    if (!nextRound) {
      return fixtures;
    }

    const alreadyCreated = fixtures.some(
      (fixture) => isDomesticCupFixture(fixture) && fixture.round === nextRound.round,
    );
    if (alreadyCreated) {
      continue;
    }

    const winners = roundFixtures
      .map(scoreWinner)
      .filter((clubId): clubId is string => Boolean(clubId));

    if (winners.length !== roundFixtures.length || winners.length < 2) {
      return fixtures;
    }

    const nextFixtures: Fixture[] = [];
    for (let index = 0; index < winners.length; index += 2) {
      const homeClubId = winners[index];
      const awayClubId = winners[index + 1];
      if (!homeClubId || !awayClubId) {
        continue;
      }
      nextFixtures.push(
        cupFixture({
          seasonNumber: input.seasonNumber,
          seasonYear: input.seasonYear,
          round: nextRound.round,
          fixtureNumber: nextFixtures.length + 1,
          homeClubId,
          awayClubId,
          leagueId: input.clubsById[homeClubId]?.leagueId,
        }),
      );
    }

    fixtures = [...fixtures, ...nextFixtures].sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.round - right.round ||
        left.id.localeCompare(right.id),
    );
  }

  return fixtures;
}

export function getCupResultLabel(fixtures: readonly Fixture[], clubId: string): string | undefined {
  const cupFixtures = fixtures
    .filter((fixture) => isDomesticCupFixture(fixture) && (fixture.homeClubId === clubId || fixture.awayClubId === clubId))
    .sort((left, right) => right.round - left.round);
  const latest = cupFixtures[0];

  if (!latest?.result) {
    return undefined;
  }

  const winner = scoreWinner(latest);
  if (latest.round === 6 && winner === clubId) {
    return "우승";
  }
  if (latest.round === 6) {
    return "준우승";
  }

  return `${DOMESTIC_CUP_ROUNDS.find((round) => round.round === latest.round)?.label ?? `${latest.round}라운드`} 탈락`;
}
