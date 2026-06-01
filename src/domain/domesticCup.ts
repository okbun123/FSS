import {
  DOMESTIC_CUP_COMPETITION_ID,
  K1_LEAGUE_ID,
  K2_LEAGUE_ID,
  K3_LEAGUE_ID,
  K4_LEAGUE_ID,
} from "../data/fictionalLeagues";
import { NON_PLAYABLE_D5_CLUBS } from "../data/nonPlayableClubs";
import type { Club, Fixture, FixtureResult, LeagueTier, NonPlayableClub } from "./types";

export type DomesticCupRoundNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DOMESTIC_CUP_ROUNDS = [
  { round: 0, label: "예선", month: 3, day: 17 },
  { round: 1, label: "1라운드", month: 4, day: 7 },
  { round: 2, label: "2라운드", month: 5, day: 5 },
  { round: 3, label: "3라운드", month: 6, day: 2 },
  { round: 4, label: "16강", month: 7, day: 7 },
  { round: 5, label: "8강", month: 8, day: 11 },
  { round: 6, label: "준결승", month: 9, day: 8 },
  { round: 7, label: "결승", month: 10, day: 3 },
] as const;

const PLAYABLE_ENTRY_ROUND: Record<LeagueTier, DomesticCupRoundNumber> = {
  [K1_LEAGUE_ID]: 3,
  [K2_LEAGUE_ID]: 2,
  [K3_LEAGUE_ID]: 1,
  [K4_LEAGUE_ID]: 1,
};

const LEAGUE_LEVEL: Record<LeagueTier, number> = {
  [K1_LEAGUE_ID]: 1,
  [K2_LEAGUE_ID]: 2,
  [K3_LEAGUE_ID]: 3,
  [K4_LEAGUE_ID]: 4,
};

interface CupEntrant {
  clubId: string;
  leagueId?: LeagueTier;
  name?: string;
  seed: number;
}

export interface CreateDomesticCupFixturesInput {
  clubs: readonly Club[];
  seasonNumber: number;
  seasonYear: number;
  includeNonPlayablePool?: boolean;
  nonPlayablePool?: readonly NonPlayableClub[];
  preliminaryPoolTeamCount?: number;
}

function isoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day, 11, 0, 0, 0)).toISOString();
}

function roundConfig(round: number): (typeof DOMESTIC_CUP_ROUNDS)[number] {
  return DOMESTIC_CUP_ROUNDS.find((candidate) => candidate.round === round) ?? DOMESTIC_CUP_ROUNDS[1];
}

function fixtureDate(seasonYear: number, round: number): string {
  const config = roundConfig(round);
  return isoDate(seasonYear, config.month, config.day);
}

function fixtureMonth(dateIso: string): number {
  return new Date(dateIso).getUTCMonth() + 1;
}

export function getDomesticCupRoundLabel(round: number): string {
  return roundConfig(round).label;
}

function leagueLevel(leagueId?: LeagueTier): number {
  return leagueId ? LEAGUE_LEVEL[leagueId] : 5;
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
    id: `domestic-fa-cup-s${input.seasonNumber}-r${input.round}-m${input.fixtureNumber}-${input.homeClubId}-${input.awayClubId}`,
    leagueId: input.leagueId ?? K4_LEAGUE_ID,
    competitionId: DOMESTIC_CUP_COMPETITION_ID,
    seasonNumber: input.seasonNumber,
    round: input.round,
    month: fixtureMonth(date),
    date,
    weekNumber: 90 + input.round,
    homeClubId: input.homeClubId,
    awayClubId: input.awayClubId,
    status: "scheduled",
  };
}

export function isDomesticCupFixture(fixture: Pick<Fixture, "competitionId">): boolean {
  return fixture.competitionId === DOMESTIC_CUP_COMPETITION_ID;
}

function clubEntrant(club: Club): CupEntrant {
  return {
    clubId: club.id,
    leagueId: club.leagueId,
    name: club.name,
    seed: leagueLevel(club.leagueId) * 1000 - club.reputation - club.squadStrength / 100,
  };
}

function poolEntrant(club: NonPlayableClub, index: number): CupEntrant {
  return {
    clubId: club.id,
    name: club.name,
    seed: 5000 - club.promotionWeight - index / 100,
  };
}

function entrantFromClubId(clubId: string, clubsById: Record<string, Club>): CupEntrant {
  const club = clubsById[clubId];

  if (club) {
    return clubEntrant(club);
  }

  const poolClub = NON_PLAYABLE_D5_CLUBS.find((candidate) => candidate.id === clubId);

  return {
    clubId,
    name: poolClub?.name ?? clubId,
    seed: 5000,
  };
}

function sortEntrants(entrants: readonly CupEntrant[]): CupEntrant[] {
  return [...entrants].sort(
    (left, right) =>
      left.seed - right.seed ||
      (left.name ?? left.clubId).localeCompare(right.name ?? right.clubId, "ko") ||
      left.clubId.localeCompare(right.clubId),
  );
}

function chooseHomeEntrant(left: CupEntrant, right: CupEntrant, fixtureIndex: number): CupEntrant {
  const leftLevel = leagueLevel(left.leagueId);
  const rightLevel = leagueLevel(right.leagueId);

  if (leftLevel !== rightLevel) {
    return leftLevel > rightLevel ? left : right;
  }

  return fixtureIndex % 2 === 0 ? left : right;
}

function createRoundFixtures(input: {
  entrants: readonly CupEntrant[];
  round: DomesticCupRoundNumber;
  seasonNumber: number;
  seasonYear: number;
}): Fixture[] {
  const entrants = sortEntrants(input.entrants);
  const pairings: Array<[CupEntrant, CupEntrant]> = [];

  for (let index = 0; index < Math.floor(entrants.length / 2); index += 1) {
    pairings.push([entrants[index], entrants[entrants.length - 1 - index]]);
  }

  return pairings.map(([left, right], index) => {
    const home = chooseHomeEntrant(left, right, index);
    const away = home.clubId === left.clubId ? right : left;

    return cupFixture({
      seasonNumber: input.seasonNumber,
      seasonYear: input.seasonYear,
      round: input.round,
      fixtureNumber: index + 1,
      homeClubId: home.clubId,
      awayClubId: away.clubId,
      leagueId: home.leagueId ?? away.leagueId,
    });
  });
}

function selectPreliminaryPoolTeams(input: {
  pool: readonly NonPlayableClub[];
  count: number;
}): NonPlayableClub[] {
  return [...input.pool]
    .filter((club) => club.licenseEligible)
    .sort(
      (left, right) =>
        right.promotionWeight - left.promotionWeight ||
        left.name.localeCompare(right.name, "ko"),
    )
    .slice(0, input.count);
}

function seededPlayableEntrants(clubs: readonly Club[]): CupEntrant[] {
  return sortEntrants(clubs.map(clubEntrant));
}

function cupParticipantIds(fixtures: readonly Fixture[]): Set<string> {
  return new Set(
    fixtures
      .filter(isDomesticCupFixture)
      .flatMap((fixture) => [fixture.homeClubId, fixture.awayClubId]),
  );
}

function playableEntrantsForRound(input: {
  round: DomesticCupRoundNumber;
  clubsById: Record<string, Club>;
  fixtures: readonly Fixture[];
}): CupEntrant[] {
  const alreadyEntered = cupParticipantIds(input.fixtures);

  return seededPlayableEntrants(Object.values(input.clubsById))
    .filter((entrant) => entrant.leagueId && PLAYABLE_ENTRY_ROUND[entrant.leagueId] === input.round)
    .filter((entrant) => !alreadyEntered.has(entrant.clubId));
}

export function createInitialDomesticCupFixtures(input: CreateDomesticCupFixturesInput): Fixture[] {
  if (input.clubs.length < 2) {
    return [];
  }

  const includePool = input.includeNonPlayablePool ?? true;
  const preliminaryPoolTeamCount = input.preliminaryPoolTeamCount ?? 10;
  const poolTeams = includePool
    ? selectPreliminaryPoolTeams({
        pool: input.nonPlayablePool ?? NON_PLAYABLE_D5_CLUBS,
        count: preliminaryPoolTeamCount,
      })
    : [];

  if (poolTeams.length >= 2 && poolTeams.length % 2 === 0) {
    return createRoundFixtures({
      entrants: poolTeams.map(poolEntrant),
      round: 0,
      seasonNumber: input.seasonNumber,
      seasonYear: input.seasonYear,
    });
  }

  return createRoundFixtures({
    entrants: seededPlayableEntrants(input.clubs),
    round: 1,
    seasonNumber: input.seasonNumber,
    seasonYear: input.seasonYear,
  });
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

  for (const currentRound of DOMESTIC_CUP_ROUNDS) {
    const roundFixtures = fixtures.filter(
      (fixture) => isDomesticCupFixture(fixture) && fixture.round === currentRound.round,
    );

    if (roundFixtures.length === 0) {
      continue;
    }

    if (roundFixtures.some((fixture) => fixture.status !== "played" || !fixture.result)) {
      return fixtures;
    }

    const nextRound = DOMESTIC_CUP_ROUNDS.find((candidate) => candidate.round === currentRound.round + 1);
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

    if (winners.length !== roundFixtures.length || winners.length < 1) {
      return fixtures;
    }

    const nextEntrants = [
      ...winners.map((clubId) => entrantFromClubId(clubId, input.clubsById)),
      ...playableEntrantsForRound({
        round: nextRound.round,
        clubsById: input.clubsById,
        fixtures,
      }),
    ];

    if (nextEntrants.length < 2) {
      return fixtures;
    }

    const nextFixtures = createRoundFixtures({
      entrants: nextEntrants,
      round: nextRound.round,
      seasonNumber: input.seasonNumber,
      seasonYear: input.seasonYear,
    });

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
    .filter(
      (fixture) =>
        isDomesticCupFixture(fixture) &&
        fixture.result &&
        (fixture.homeClubId === clubId || fixture.awayClubId === clubId),
    )
    .sort(
      (left, right) =>
        right.round - left.round ||
        right.date.localeCompare(left.date) ||
        right.id.localeCompare(left.id),
    );
  const latest = cupFixtures[0];

  if (!latest?.result) {
    return undefined;
  }

  const winner = scoreWinner(latest);
  if (latest.round === 7 && winner === clubId) {
    return "우승";
  }
  if (latest.round === 7) {
    return "준우승";
  }

  return `${getDomesticCupRoundLabel(latest.round)} 탈락`;
}

export function getCupResultImpactScore(result?: string): number {
  if (!result) {
    return 0;
  }

  if (result === "우승") {
    return 3;
  }
  if (result === "준우승") {
    return 2;
  }
  if (result.includes("준결승")) {
    return 1.25;
  }
  if (result.includes("8강")) {
    return 0.7;
  }
  if (result.includes("16강")) {
    return 0.45;
  }
  if (result.includes("3라운드")) {
    return 0.25;
  }
  return 0;
}
