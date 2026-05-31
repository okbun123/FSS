import type {
  Fixture,
  FixtureResult,
  LeagueTier,
  PlayoffBracket,
  PlayoffStage,
  PlayoffTie,
} from "./types";

const PLAYOFF_COMPETITION_PREFIX = "competition-promotion-relegation";

export interface SeededClub {
  clubId: string;
  position: number;
}

export interface PlayoffTieResolution {
  tieId: string;
  winnerClubId: string;
  loserClubId: string;
  decidedBy: FixtureResult["decidedBy"] | "higherSeed";
}

interface CreatePlayoffFixtureInput {
  id: string;
  seasonNumber: number;
  leagueId: LeagueTier;
  competitionId: string;
  round: number;
  date: string;
  homeClubId: string;
  awayClubId: string;
  bracketId: string;
  roundId: string;
  tieId: string;
  stage: PlayoffStage;
  tieFormat: "singleLeg" | "twoLegged";
  leg: number;
  totalLegs: number;
  higherSeedClubId?: string;
  drawAdvantageClubId?: string;
}

interface CreateTieFixtureInput {
  seasonNumber: number;
  leagueId: LeagueTier;
  competitionId: string;
  baseRound: number;
  baseDate: string;
  bracketId: string;
  roundId: string;
  tieId: string;
  stage: PlayoffStage;
  homeClubId: string;
  awayClubId: string;
  higherSeedClubId?: string;
  drawAdvantageClubId?: string;
}

function toIsoDate(date: Date): string {
  return date.toISOString();
}

function addDays(dateIso: string, days: number): string {
  const date = new Date(dateIso);
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(11, 0, 0, 0);
  return toIsoDate(date);
}

export function getPromotionRelegationCompetitionId(seasonNumber: number): string {
  return `${PLAYOFF_COMPETITION_PREFIX}-s${seasonNumber}`;
}

export function getLatestFixtureDate(fixtures: readonly Fixture[]): string {
  const latestFixture = [...fixtures]
    .filter((fixture) => !fixture.playoff)
    .sort((left, right) => right.date.localeCompare(left.date))[0];

  return latestFixture?.date ?? new Date(Date.UTC(2026, 11, 1, 11, 0, 0, 0)).toISOString();
}

export function getNextPlayoffDate(fixtures: readonly Fixture[], weeksAfterLatest = 1): string {
  const latestFixture = [...fixtures].sort((left, right) => right.date.localeCompare(left.date))[0];

  return addDays(latestFixture?.date ?? getLatestFixtureDate(fixtures), weeksAfterLatest * 7);
}

function getFixtureMonth(dateIso: string): number {
  return new Date(dateIso).getUTCMonth() + 1;
}

function createPlayoffFixture(input: CreatePlayoffFixtureInput): Fixture {
  return {
    id: input.id,
    leagueId: input.leagueId,
    competitionId: input.competitionId,
    seasonNumber: input.seasonNumber,
    round: input.round,
    month: getFixtureMonth(input.date),
    date: input.date,
    weekNumber: input.round,
    homeClubId: input.homeClubId,
    awayClubId: input.awayClubId,
    status: "scheduled",
    playoff: {
      bracketId: input.bracketId,
      roundId: input.roundId,
      tieId: input.tieId,
      stage: input.stage,
      tieFormat: input.tieFormat,
      leg: input.leg,
      totalLegs: input.totalLegs,
      higherSeedClubId: input.higherSeedClubId,
      drawAdvantageClubId: input.drawAdvantageClubId,
    },
  };
}

function createSingleLegFixture(input: CreateTieFixtureInput): Fixture {
  return createPlayoffFixture({
    ...input,
    id: `${input.tieId}-leg-1`,
    round: input.baseRound,
    date: input.baseDate,
    tieFormat: "singleLeg",
    leg: 1,
    totalLegs: 1,
  });
}

function createTwoLeggedFixtures(input: CreateTieFixtureInput): Fixture[] {
  return [
    createPlayoffFixture({
      ...input,
      id: `${input.tieId}-leg-1`,
      round: input.baseRound,
      date: input.baseDate,
      tieFormat: "twoLegged",
      leg: 1,
      totalLegs: 2,
    }),
    createPlayoffFixture({
      ...input,
      id: `${input.tieId}-leg-2`,
      round: input.baseRound + 1,
      date: addDays(input.baseDate, 7),
      homeClubId: input.awayClubId,
      awayClubId: input.homeClubId,
      tieFormat: "twoLegged",
      leg: 2,
      totalLegs: 2,
    }),
  ];
}

function createTie(input: {
  id: string;
  roundId: string;
  name: string;
  stage: PlayoffStage;
  fixtureIds: string[];
  clubIds: string[];
  tieFormat: "singleLeg" | "twoLegged";
  higherSeedClubId?: string;
  drawAdvantageClubId?: string;
}): PlayoffTie {
  return {
    ...input,
    status: "scheduled",
  };
}

function createBracket(input: {
  id: string;
  competitionId: string;
  seasonNumber: number;
  name: string;
  entrantClubIds: string[];
  roundId: string;
  roundName: string;
  ties: PlayoffTie[];
}): PlayoffBracket {
  return {
    id: input.id,
    competitionId: input.competitionId,
    seasonNumber: input.seasonNumber,
    name: input.name,
    entrantClubIds: input.entrantClubIds,
    rounds: [
      {
        id: input.roundId,
        name: input.roundName,
        fixtureIds: input.ties.flatMap((tie) => tie.fixtureIds),
        status: "scheduled",
      },
    ],
    ties: input.ties,
  };
}

export function createPromotionPlayoffSemifinals(input: {
  seasonNumber: number;
  leagueId: LeagueTier;
  seededClubs: readonly SeededClub[];
  fixtures: readonly Fixture[];
}): { fixtures: Fixture[]; bracket: PlayoffBracket } {
  const competitionId = getPromotionRelegationCompetitionId(input.seasonNumber);
  const bracketId = `promotion-playoff-s${input.seasonNumber}`;
  const roundId = `${bracketId}-semifinals`;
  const baseRound = Math.max(1, ...input.fixtures.map((fixture) => fixture.round)) + 1;
  const baseDate = getNextPlayoffDate(input.fixtures);
  const orderedSeeds = [...input.seededClubs].sort((left, right) => left.position - right.position);
  const pairings = [
    [orderedSeeds[0], orderedSeeds[3]],
    [orderedSeeds[1], orderedSeeds[2]],
  ].filter((pairing): pairing is [SeededClub, SeededClub] => Boolean(pairing[0] && pairing[1]));

  const playoffFixtures = pairings.map(([higherSeed, lowerSeed], index) =>
    createSingleLegFixture({
      seasonNumber: input.seasonNumber,
      leagueId: input.leagueId,
      competitionId,
      baseRound,
      baseDate,
      bracketId,
      roundId,
      tieId: `${roundId}-${index + 1}`,
      stage: "promotionPlayoffSemifinals",
      homeClubId: higherSeed.clubId,
      awayClubId: lowerSeed.clubId,
      higherSeedClubId: higherSeed.clubId,
      drawAdvantageClubId: higherSeed.clubId,
    }),
  );
  const ties = playoffFixtures.map((fixture, index) =>
    createTie({
      id: fixture.playoff?.tieId ?? fixture.id,
      roundId,
      name: `승격 PO 준결승 ${index + 1}`,
      stage: "promotionPlayoffSemifinals",
      fixtureIds: [fixture.id],
      clubIds: [fixture.homeClubId, fixture.awayClubId],
      tieFormat: "singleLeg",
      higherSeedClubId: fixture.playoff?.higherSeedClubId,
      drawAdvantageClubId: fixture.playoff?.drawAdvantageClubId,
    }),
  );

  return {
    fixtures: playoffFixtures,
    bracket: createBracket({
      id: bracketId,
      competitionId,
      seasonNumber: input.seasonNumber,
      name: "승격 플레이오프",
      entrantClubIds: orderedSeeds.map((seed) => seed.clubId),
      roundId,
      roundName: "준결승",
      ties,
    }),
  };
}

export function createPromotionPlayoffFinal(input: {
  seasonNumber: number;
  leagueId: LeagueTier;
  finalists: readonly SeededClub[];
  fixtures: readonly Fixture[];
  existingBracket?: PlayoffBracket;
}): { fixtures: Fixture[]; bracket: PlayoffBracket } {
  const competitionId = getPromotionRelegationCompetitionId(input.seasonNumber);
  const bracketId = input.existingBracket?.id ?? `promotion-playoff-s${input.seasonNumber}`;
  const roundId = `${bracketId}-final`;
  const baseRound = Math.max(1, ...input.fixtures.map((fixture) => fixture.round)) + 1;
  const baseDate = getNextPlayoffDate(input.fixtures);
  const [higherSeed, lowerSeed] = [...input.finalists].sort((left, right) => left.position - right.position);
  const fixture = createSingleLegFixture({
    seasonNumber: input.seasonNumber,
    leagueId: input.leagueId,
    competitionId,
    baseRound,
    baseDate,
    bracketId,
    roundId,
    tieId: `${roundId}-1`,
    stage: "promotionPlayoffFinal",
    homeClubId: higherSeed.clubId,
    awayClubId: lowerSeed.clubId,
    higherSeedClubId: higherSeed.clubId,
    drawAdvantageClubId: higherSeed.clubId,
  });
  const tie = createTie({
    id: fixture.playoff?.tieId ?? fixture.id,
    roundId,
    name: "승격 PO 결승",
    stage: "promotionPlayoffFinal",
    fixtureIds: [fixture.id],
    clubIds: [fixture.homeClubId, fixture.awayClubId],
    tieFormat: "singleLeg",
    higherSeedClubId: fixture.playoff?.higherSeedClubId,
    drawAdvantageClubId: fixture.playoff?.drawAdvantageClubId,
  });

  return {
    fixtures: [fixture],
    bracket: {
      ...(input.existingBracket ?? createBracket({
        id: bracketId,
        competitionId,
        seasonNumber: input.seasonNumber,
        name: "승격 플레이오프",
        entrantClubIds: input.finalists.map((seed) => seed.clubId),
        roundId,
        roundName: "결승",
        ties: [],
      })),
      rounds: [
        ...(input.existingBracket?.rounds ?? []),
        {
          id: roundId,
          name: "결승",
          fixtureIds: [fixture.id],
          status: "scheduled",
        },
      ],
      ties: [...(input.existingBracket?.ties ?? []), tie],
    },
  };
}

export function createPromotionRelegationTie(input: {
  seasonNumber: number;
  leagueId: LeagueTier;
  k1ClubId: string;
  k2ClubId: string;
  fixtures: readonly Fixture[];
  existingBracket?: PlayoffBracket;
}): { fixtures: Fixture[]; bracket: PlayoffBracket } {
  const competitionId = getPromotionRelegationCompetitionId(input.seasonNumber);
  const bracketId = input.existingBracket?.id ?? `promotion-playoff-s${input.seasonNumber}`;
  const roundId = `${bracketId}-promotion-relegation`;
  const tieId = `${roundId}-1`;
  const baseRound = Math.max(1, ...input.fixtures.map((fixture) => fixture.round)) + 1;
  const baseDate = getNextPlayoffDate(input.fixtures);
  const playoffFixtures = createTwoLeggedFixtures({
    seasonNumber: input.seasonNumber,
    leagueId: input.leagueId,
    competitionId,
    baseRound,
    baseDate,
    bracketId,
    roundId,
    tieId,
    stage: "promotionRelegationPlayoff",
    homeClubId: input.k2ClubId,
    awayClubId: input.k1ClubId,
    higherSeedClubId: input.k1ClubId,
  });
  const tie = createTie({
    id: tieId,
    roundId,
    name: "승강 플레이오프",
    stage: "promotionRelegationPlayoff",
    fixtureIds: playoffFixtures.map((fixture) => fixture.id),
    clubIds: [input.k2ClubId, input.k1ClubId],
    tieFormat: "twoLegged",
    higherSeedClubId: input.k1ClubId,
  });

  return {
    fixtures: playoffFixtures,
    bracket: {
      ...(input.existingBracket ?? createBracket({
        id: bracketId,
        competitionId,
        seasonNumber: input.seasonNumber,
        name: "승강 플레이오프",
        entrantClubIds: [input.k2ClubId, input.k1ClubId],
        roundId,
        roundName: "승강 플레이오프",
        ties: [],
      })),
      rounds: [
        ...(input.existingBracket?.rounds ?? []),
        {
          id: roundId,
          name: "승강 플레이오프",
          fixtureIds: playoffFixtures.map((fixture) => fixture.id),
          status: "scheduled",
        },
      ],
      ties: [...(input.existingBracket?.ties ?? []), tie],
    },
  };
}

export function resolveSingleLegPlayoffFixture(fixture: Fixture): PlayoffTieResolution | undefined {
  if (!fixture.result || !fixture.playoff) {
    return undefined;
  }

  const homeWon = fixture.result.homeGoals > fixture.result.awayGoals;
  const awayWon = fixture.result.awayGoals > fixture.result.homeGoals;
  const winnerClubId = homeWon
    ? fixture.homeClubId
    : awayWon
      ? fixture.awayClubId
      : fixture.result.winnerClubId ?? fixture.playoff.drawAdvantageClubId;

  if (!winnerClubId) {
    return undefined;
  }

  return {
    tieId: fixture.playoff.tieId,
    winnerClubId,
    loserClubId: winnerClubId === fixture.homeClubId ? fixture.awayClubId : fixture.homeClubId,
    decidedBy: homeWon || awayWon ? fixture.result.decidedBy ?? "normalTime" : "higherSeed",
  };
}

export function resolveTwoLeggedTie(fixtures: readonly Fixture[]): PlayoffTieResolution | undefined {
  const [firstLeg, secondLeg] = [...fixtures].sort(
    (left, right) => (left.playoff?.leg ?? 0) - (right.playoff?.leg ?? 0),
  );

  if (!firstLeg?.result || !secondLeg?.result || !firstLeg.playoff || !secondLeg.playoff) {
    return undefined;
  }

  const clubs = [firstLeg.homeClubId, firstLeg.awayClubId];
  const totals = new Map(clubs.map((clubId) => [clubId, 0]));

  for (const fixture of [firstLeg, secondLeg]) {
    totals.set(fixture.homeClubId, (totals.get(fixture.homeClubId) ?? 0) + (fixture.result?.homeGoals ?? 0));
    totals.set(fixture.awayClubId, (totals.get(fixture.awayClubId) ?? 0) + (fixture.result?.awayGoals ?? 0));
  }

  const [leftClubId, rightClubId] = clubs;
  const leftGoals = totals.get(leftClubId) ?? 0;
  const rightGoals = totals.get(rightClubId) ?? 0;
  const winnerClubId = leftGoals > rightGoals
    ? leftClubId
    : rightGoals > leftGoals
      ? rightClubId
      : secondLeg.result.winnerClubId;

  if (!winnerClubId) {
    return undefined;
  }

  const aggregateDecidedBy = leftGoals === rightGoals
    ? secondLeg.result.decidedBy ?? "penalties"
    : "normalTime";

  return {
    tieId: secondLeg.playoff.tieId,
    winnerClubId,
    loserClubId: winnerClubId === leftClubId ? rightClubId : leftClubId,
    decidedBy: aggregateDecidedBy,
  };
}

export function getAggregateScoreBeforeFixture(
  fixtures: readonly Fixture[],
  fixture: Fixture,
): { homeGoals: number; awayGoals: number } | undefined {
  if (!fixture.playoff || fixture.playoff.tieFormat !== "twoLegged" || fixture.playoff.leg !== 2) {
    return undefined;
  }

  const firstLeg = fixtures.find(
    (candidate) =>
      candidate.playoff?.tieId === fixture.playoff?.tieId &&
      candidate.playoff?.leg === 1 &&
      candidate.result,
  );

  if (!firstLeg?.result) {
    return undefined;
  }

  return {
    homeGoals: firstLeg.homeClubId === fixture.homeClubId ? firstLeg.result.homeGoals : firstLeg.result.awayGoals,
    awayGoals: firstLeg.homeClubId === fixture.awayClubId ? firstLeg.result.homeGoals : firstLeg.result.awayGoals,
  };
}

export function shouldUseKnockoutMatchState(fixtures: readonly Fixture[], fixture: Fixture): boolean {
  if (!fixture.playoff) {
    return false;
  }

  if (fixture.playoff.tieFormat === "singleLeg") {
    return !fixture.playoff.drawAdvantageClubId;
  }

  return fixture.playoff.leg === 2 && Boolean(getAggregateScoreBeforeFixture(fixtures, fixture));
}
