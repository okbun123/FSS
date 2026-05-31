import { getLeagueRuleSet } from "./leagueRules";
import {
  createPromotionPlayoffFinal,
  createPromotionPlayoffSemifinals,
  createPromotionRelegationTie,
  resolveSingleLegPlayoffFixture,
  resolveTwoLeggedTie,
  type PlayoffTieResolution,
  type SeededClub,
} from "./playoffs";
import type {
  Fixture,
  League,
  LeagueTableRow,
  LeagueTier,
  PlayoffBracket,
  PromotionRelegationPlayoffResult,
  PromotionRelegationStatus,
} from "./types";

const K1_LEAGUE_ID = "k1_fictional" satisfies LeagueTier;
const K2_LEAGUE_ID = "k2_fictional" satisfies LeagueTier;

export interface PromotionRelegationProgressInput {
  seasonNumber: number;
  seasonStartYear: number;
  leagues: Record<LeagueTier, League>;
  tables: Record<LeagueTier, LeagueTableRow[]>;
  fixtures: readonly Fixture[];
  currentStatus?: PromotionRelegationStatus;
}

export interface PromotionRelegationProgressResult {
  fixtures: Fixture[];
  status: PromotionRelegationStatus;
  addedFixtureIds: string[];
}

function clubName(tables: Record<LeagueTier, LeagueTableRow[]>, clubId?: string): string {
  if (!clubId) {
    return "";
  }

  return Object.values(tables)
    .flat()
    .find((row) => row.clubId === clubId)?.clubName ?? clubId;
}

function rowsInPositionRange(
  table: readonly LeagueTableRow[],
  start?: number,
  end?: number,
): LeagueTableRow[] {
  if (!start || !end) {
    return [];
  }

  return table.filter((row) => row.position >= start && row.position <= end);
}

function rowsFromBottom(table: readonly LeagueTableRow[], positionsFromBottom: readonly number[] = []): LeagueTableRow[] {
  return positionsFromBottom
    .map((positionFromBottom) => table[table.length - positionFromBottom])
    .filter((row): row is LeagueTableRow => Boolean(row));
}

function getSeededClubs(rows: readonly LeagueTableRow[]): SeededClub[] {
  return rows.map((row) => ({
    clubId: row.clubId,
    position: row.position,
  }));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function removeValues(values: readonly string[], removals: readonly string[]): string[] {
  const removalSet = new Set(removals);

  return values.filter((value) => !removalSet.has(value));
}

function isSpecialBottomClub(ruleSet: League["ruleSet"], clubId?: string): boolean {
  return Boolean(clubId && ruleSet.transitionSpecialCase?.clubIds.includes(clubId));
}

function createInitialStatus(input: PromotionRelegationProgressInput): PromotionRelegationStatus {
  const k1RuleSet = getLeagueRuleSet(K1_LEAGUE_ID, input.seasonStartYear);
  const k2RuleSet = getLeagueRuleSet(K2_LEAGUE_ID, input.seasonStartYear);
  const k1Table = input.tables[K1_LEAGUE_ID];
  const k2Table = input.tables[K2_LEAGUE_ID];
  const directPromotionClubIds = k2Table.slice(0, k2RuleSet.directPromotionSlots).map((row) => row.clubId);
  const directRelegationClubIds = k1RuleSet.directRelegationSlots > 0
    ? k1Table.slice(-k1RuleSet.directRelegationSlots).map((row) => row.clubId)
    : [];
  const promotionPlayoffRows = rowsInPositionRange(
    k2Table,
    k2RuleSet.promotionPlayoffConfig?.entrantPositionStart,
    k2RuleSet.promotionPlayoffConfig?.entrantPositionEnd,
  );
  const bottomK1Row = k1Table.at(-1);
  const transitionSpecialCase = k1RuleSet.transitionSpecialCase;
  const specialBottom = isSpecialBottomClub(k1RuleSet, bottomK1Row?.clubId);
  const transitionDirectRelegationClubIds =
    transitionSpecialCase?.bottomClubDirectRelegation && specialBottom && bottomK1Row
      ? [bottomK1Row.clubId]
      : [];
  const relegationPlayoffClubIds =
    transitionSpecialCase?.ifBottomSkipsRelegationPlayoff && specialBottom
      ? []
      : rowsFromBottom(k1Table, k1RuleSet.relegationPlayoffConfig?.entrantPositionsFromBottom).map((row) => row.clubId);
  const allDirectRelegationClubIds = unique([...directRelegationClubIds, ...transitionDirectRelegationClubIds]);
  const note = [
    directPromotionClubIds.length > 0
      ? `${directPromotionClubIds.map((clubId) => clubName(input.tables, clubId)).join(", ")} 직행 승격`
      : undefined,
    allDirectRelegationClubIds.length > 0
      ? `${allDirectRelegationClubIds.map((clubId) => clubName(input.tables, clubId)).join(", ")} 직행 강등`
      : undefined,
    promotionPlayoffRows.length > 0 ? "승격 플레이오프가 생성됩니다." : undefined,
    specialBottom ? "전환 특례로 K1 추가 승강 플레이오프가 생략됩니다." : undefined,
  ].filter((text): text is string => Boolean(text)).join(" / ");

  return {
    seasonNumber: input.seasonNumber,
    seasonStartYear: input.seasonStartYear,
    ruleSetIds: {
      [K1_LEAGUE_ID]: k1RuleSet.id,
      [K2_LEAGUE_ID]: k2RuleSet.id,
    },
    stage: promotionPlayoffRows.length >= 2 ? "promotionPlayoffSemifinals" : "resolved",
    isResolved: promotionPlayoffRows.length < 2,
    directPromotionClubIds,
    directRelegationClubIds: allDirectRelegationClubIds,
    promotionPlayoffClubIds: promotionPlayoffRows.map((row) => row.clubId),
    relegationPlayoffClubIds,
    promotedClubIds: promotionPlayoffRows.length < 2 ? directPromotionClubIds : [],
    relegatedClubIds: promotionPlayoffRows.length < 2 ? allDirectRelegationClubIds : [],
    playoffFixtureIds: [],
    playoffResults: [],
    automaticPromotionClubId: directPromotionClubIds[0],
    promotionPlayoffClubId: promotionPlayoffRows[0]?.clubId,
    automaticRelegationClubId: allDirectRelegationClubIds[0],
    playoffClubId: relegationPlayoffClubIds[0],
    note: note || "승강 규정에 따라 시즌 종료 처리를 준비합니다.",
  };
}

function appendFixtures(
  existingFixtures: readonly Fixture[],
  newFixtures: readonly Fixture[],
): Fixture[] {
  const existingIds = new Set(existingFixtures.map((fixture) => fixture.id));

  return [
    ...existingFixtures,
    ...newFixtures.filter((fixture) => !existingIds.has(fixture.id)),
  ].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.round - right.round ||
      left.id.localeCompare(right.id),
  );
}

function stageFixtures(fixtures: readonly Fixture[], status: PromotionRelegationStatus, stage = status.stage): Fixture[] {
  const fixtureIds = new Set(status.playoffFixtureIds ?? []);

  return fixtures.filter(
    (fixture) =>
      fixtureIds.has(fixture.id) &&
      fixture.playoff?.stage === stage,
  );
}

function allPlayed(fixtures: readonly Fixture[]): boolean {
  return fixtures.length > 0 && fixtures.every((fixture) => fixture.status === "played" && fixture.result);
}

function resultToSummary(
  resolution: PlayoffTieResolution,
  name: string,
  stageFixturesForTie: readonly Fixture[],
): PromotionRelegationPlayoffResult {
  return {
    id: resolution.tieId,
    stage: stageFixturesForTie[0]?.playoff?.stage ?? "promotionPlayoffSemifinals",
    name,
    fixtureIds: stageFixturesForTie.map((fixture) => fixture.id),
    clubIds: [resolution.winnerClubId, resolution.loserClubId],
    winnerClubId: resolution.winnerClubId,
    loserClubId: resolution.loserClubId,
    decidedBy: resolution.decidedBy,
  };
}

function mergeBracket(existing: PlayoffBracket | undefined, next: PlayoffBracket): PlayoffBracket {
  if (!existing) {
    return next;
  }

  const roundIds = new Set(existing.rounds.map((round) => round.id));
  const tieIds = new Set((existing.ties ?? []).map((tie) => tie.id));

  return {
    ...existing,
    rounds: [
      ...existing.rounds,
      ...next.rounds.filter((round) => !roundIds.has(round.id)),
    ],
    ties: [
      ...(existing.ties ?? []),
      ...(next.ties ?? []).filter((tie) => !tieIds.has(tie.id)),
    ],
  };
}

function getSeedForClub(status: PromotionRelegationStatus, clubId: string): SeededClub {
  const index = status.promotionPlayoffClubIds?.indexOf(clubId) ?? -1;

  return {
    clubId,
    position: index >= 0 ? index + 1 : 99,
  };
}

function resolveSemifinals(input: PromotionRelegationProgressInput, status: PromotionRelegationStatus) {
  const semifinals = stageFixtures(input.fixtures, status, "promotionPlayoffSemifinals");

  if (!allPlayed(semifinals)) {
    return undefined;
  }

  const resolutions = semifinals
    .map((fixture) => resolveSingleLegPlayoffFixture(fixture))
    .filter((resolution): resolution is PlayoffTieResolution => Boolean(resolution));

  if (resolutions.length !== semifinals.length) {
    return undefined;
  }

  const finalists = resolutions.map((resolution) => getSeedForClub(status, resolution.winnerClubId));
  const final = createPromotionPlayoffFinal({
    seasonNumber: input.seasonNumber,
    leagueId: K2_LEAGUE_ID,
    finalists,
    fixtures: input.fixtures,
    existingBracket: status.playoffBracket,
  });
  const playoffResults = [
    ...(status.playoffResults ?? []),
    ...resolutions.map((resolution) =>
      resultToSummary(
        resolution,
        "승격 PO 준결승",
        semifinals.filter((fixture) => fixture.playoff?.tieId === resolution.tieId),
      ),
    ),
  ];

  return {
    fixtures: appendFixtures(input.fixtures, final.fixtures),
    addedFixtureIds: final.fixtures.map((fixture) => fixture.id),
    status: {
      ...status,
      stage: "promotionPlayoffFinal" as const,
      isResolved: false,
      playoffFixtureIds: unique([...(status.playoffFixtureIds ?? []), ...final.fixtures.map((fixture) => fixture.id)]),
      playoffResults,
      playoffBracket: mergeBracket(status.playoffBracket, final.bracket),
      note: "승격 플레이오프 결승이 생성되었습니다.",
    },
  };
}

function resolveFinal(input: PromotionRelegationProgressInput, status: PromotionRelegationStatus) {
  const finalFixtures = stageFixtures(input.fixtures, status, "promotionPlayoffFinal");

  if (!allPlayed(finalFixtures)) {
    return undefined;
  }

  const finalResolution = resolveSingleLegPlayoffFixture(finalFixtures[0]);

  if (!finalResolution) {
    return undefined;
  }

  const k1RuleSet = getLeagueRuleSet(K1_LEAGUE_ID, input.seasonStartYear);
  const k2RuleSet = getLeagueRuleSet(K2_LEAGUE_ID, input.seasonStartYear);
  const finalWinnerPromotion = input.seasonStartYear <= 2026;
  const directPromotionClubIds = status.directPromotionClubIds ?? [];
  const directRelegationClubIds = status.directRelegationClubIds ?? [];
  const k1PlayoffClubId = status.relegationPlayoffClubIds?.[0];
  const playoffResults = [
    ...(status.playoffResults ?? []),
    resultToSummary(finalResolution, "승격 PO 결승", finalFixtures),
  ];
  const promotedAfterFinal = finalWinnerPromotion
    ? unique([...directPromotionClubIds, finalResolution.winnerClubId])
    : [...directPromotionClubIds];
  const shouldCreatePromotionRelegationTie =
    Boolean(k1RuleSet.relegationPlayoffConfig && k2RuleSet.promotionPlayoffConfig && k1PlayoffClubId);

  if (!shouldCreatePromotionRelegationTie || !k1PlayoffClubId) {
    return {
      fixtures: [...input.fixtures],
      addedFixtureIds: [],
      status: {
        ...status,
        stage: "resolved" as const,
        isResolved: true,
        promotedClubIds: promotedAfterFinal,
        relegatedClubIds: directRelegationClubIds,
        playoffResults,
        note: "승강 결과가 확정되었습니다.",
      },
    };
  }

  const challengerClubId = input.seasonStartYear <= 2026
    ? finalResolution.loserClubId
    : finalResolution.winnerClubId;
  const tie = createPromotionRelegationTie({
    seasonNumber: input.seasonNumber,
    leagueId: K1_LEAGUE_ID,
    k1ClubId: k1PlayoffClubId,
    k2ClubId: challengerClubId,
    fixtures: input.fixtures,
    existingBracket: status.playoffBracket,
  });

  return {
    fixtures: appendFixtures(input.fixtures, tie.fixtures),
    addedFixtureIds: tie.fixtures.map((fixture) => fixture.id),
    status: {
      ...status,
      stage: "promotionRelegationPlayoff" as const,
      isResolved: false,
      promotedClubIds: promotedAfterFinal,
      relegatedClubIds: directRelegationClubIds,
      playoffFixtureIds: unique([...(status.playoffFixtureIds ?? []), ...tie.fixtures.map((fixture) => fixture.id)]),
      playoffResults,
      playoffBracket: mergeBracket(status.playoffBracket, tie.bracket),
      note: "승강 플레이오프 2경기가 생성되었습니다.",
    },
  };
}

function resolvePromotionRelegationPlayoff(input: PromotionRelegationProgressInput, status: PromotionRelegationStatus) {
  const prFixtures = stageFixtures(input.fixtures, status, "promotionRelegationPlayoff");

  if (!allPlayed(prFixtures)) {
    return undefined;
  }

  const resolution = resolveTwoLeggedTie(prFixtures);

  if (!resolution) {
    return undefined;
  }

  const k1ClubId = status.relegationPlayoffClubIds?.[0];
  const k2ClubId = resolution.winnerClubId === k1ClubId ? resolution.loserClubId : resolution.winnerClubId;
  const k2WinsTie = resolution.winnerClubId === k2ClubId;
  const promotedClubIds = k2WinsTie
    ? unique([...(status.promotedClubIds ?? status.directPromotionClubIds ?? []), k2ClubId])
    : [...(status.promotedClubIds ?? status.directPromotionClubIds ?? [])];
  const relegatedClubIds = k2WinsTie && k1ClubId
    ? unique([...(status.relegatedClubIds ?? status.directRelegationClubIds ?? []), k1ClubId])
    : [...(status.relegatedClubIds ?? status.directRelegationClubIds ?? [])];

  return {
    fixtures: [...input.fixtures],
    addedFixtureIds: [],
    status: {
      ...status,
      stage: "resolved" as const,
      isResolved: true,
      promotedClubIds,
      relegatedClubIds,
      playoffResults: [
        ...(status.playoffResults ?? []),
        resultToSummary(resolution, "승강 플레이오프", prFixtures),
      ],
      note: "승강 결과가 확정되었습니다.",
    },
  };
}

function createInitialPlayoffs(input: PromotionRelegationProgressInput, status: PromotionRelegationStatus) {
  if (status.isResolved || status.promotionPlayoffClubIds?.length !== 4) {
    return {
      fixtures: [...input.fixtures],
      status,
      addedFixtureIds: [],
    };
  }

  const k2Rows = input.tables[K2_LEAGUE_ID].filter((row) => status.promotionPlayoffClubIds?.includes(row.clubId));
  const semifinals = createPromotionPlayoffSemifinals({
    seasonNumber: input.seasonNumber,
    leagueId: K2_LEAGUE_ID,
    seededClubs: getSeededClubs(k2Rows),
    fixtures: input.fixtures,
  });

  return {
    fixtures: appendFixtures(input.fixtures, semifinals.fixtures),
    addedFixtureIds: semifinals.fixtures.map((fixture) => fixture.id),
    status: {
      ...status,
      stage: "promotionPlayoffSemifinals" as const,
      isResolved: false,
      playoffFixtureIds: semifinals.fixtures.map((fixture) => fixture.id),
      playoffBracket: semifinals.bracket,
      note: "승격 플레이오프 준결승이 생성되었습니다.",
    },
  };
}

export function progressPromotionRelegation(
  input: PromotionRelegationProgressInput,
): PromotionRelegationProgressResult {
  const status = input.currentStatus ?? createInitialStatus(input);

  if (!input.currentStatus) {
    return createInitialPlayoffs(input, status);
  }

  if (status.isResolved || status.stage === "resolved") {
    return {
      fixtures: [...input.fixtures],
      status,
      addedFixtureIds: [],
    };
  }

  const next = status.stage === "promotionPlayoffSemifinals"
    ? resolveSemifinals(input, status)
    : status.stage === "promotionPlayoffFinal"
      ? resolveFinal(input, status)
      : status.stage === "promotionRelegationPlayoff"
        ? resolvePromotionRelegationPlayoff(input, status)
        : undefined;

  return next ?? {
    fixtures: [...input.fixtures],
    status,
    addedFixtureIds: [],
  };
}

export function getPromotionRelegationZoneLabel(input: {
  row: LeagueTableRow;
  leagueId: LeagueTier;
  seasonStartYear: number;
  totalClubs: number;
}): string {
  const ruleSet = getLeagueRuleSet(input.leagueId, input.seasonStartYear);
  const position = input.row.position;

  if (ruleSet.directPromotionSlots > 0 && position <= ruleSet.directPromotionSlots) {
    return "직행 승격";
  }

  if (
    ruleSet.promotionPlayoffConfig?.entrantPositionStart &&
    ruleSet.promotionPlayoffConfig.entrantPositionEnd &&
    position >= ruleSet.promotionPlayoffConfig.entrantPositionStart &&
    position <= ruleSet.promotionPlayoffConfig.entrantPositionEnd
  ) {
    return "승격 PO";
  }

  if (ruleSet.directRelegationSlots > 0 && position > input.totalClubs - ruleSet.directRelegationSlots) {
    return "직행 강등";
  }

  if (
    ruleSet.relegationPlayoffConfig?.entrantPositionsFromBottom?.some(
      (positionFromBottom) => position === input.totalClubs - positionFromBottom + 1,
    )
  ) {
    return "강등 PO";
  }

  return "-";
}

export function finalMovementSummary(status?: PromotionRelegationStatus): {
  promotedClubIds: string[];
  relegatedClubIds: string[];
  playoffClubIds: string[];
} {
  return {
    promotedClubIds: status?.promotedClubIds ?? status?.directPromotionClubIds ?? [],
    relegatedClubIds: status?.relegatedClubIds ?? status?.directRelegationClubIds ?? [],
    playoffClubIds: unique([
      ...(status?.promotionPlayoffClubIds ?? []),
      ...(status?.relegationPlayoffClubIds ?? []),
    ]),
  };
}

export function withoutDirectMovements(status: PromotionRelegationStatus): PromotionRelegationStatus {
  return {
    ...status,
    promotedClubIds: removeValues(status.promotedClubIds ?? [], status.directPromotionClubIds ?? []),
    relegatedClubIds: removeValues(status.relegatedClubIds ?? [], status.directRelegationClubIds ?? []),
  };
}
