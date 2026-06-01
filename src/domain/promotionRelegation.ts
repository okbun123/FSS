import {
  getLeagueRuleSet,
  getNonPlayablePoolReplacementRule,
  getRulesByConcept,
} from "./leagueRuleSet";
import { checkPromotionEligibility } from "./licensing";
import {
  createPromotionPlayoffFinal,
  createPromotionPlayoffSemifinals,
  createPromotionRelegationTie,
  createSingleLegPromotionRelegationTie,
  resolveSingleLegPlayoffFixture,
  resolveTwoLeggedTie,
  type PlayoffTieResolution,
  type SeededClub,
} from "./playoffs";
import {
  K1_LEAGUE_ID,
  K2_LEAGUE_ID,
  K3_LEAGUE_ID,
  K4_LEAGUE_ID,
} from "./leagueIds";
import type {
  Club,
  Fixture,
  K4K5Mode,
  League,
  LeagueMovementRule,
  LeagueTableRow,
  LeagueTier,
  PlayoffBracket,
  PromotionRelegationPlayoffResult,
  PromotionRelegationStatus,
  PromotionRelegationTieRecord,
} from "./types";

export interface PromotionRelegationProgressInput {
  seasonNumber: number;
  seasonStartYear: number;
  leagues: Record<LeagueTier, League>;
  tables: Record<LeagueTier, LeagueTableRow[]>;
  fixtures: readonly Fixture[];
  currentStatus?: PromotionRelegationStatus;
  k4K5Mode?: K4K5Mode;
  /** @deprecated Use k4K5Mode. */
  leagueMode?: "realistic" | "gameplay";
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

function getRuleSet(input: PromotionRelegationProgressInput, leagueId: LeagueTier) {
  const leagueRuleSet = input.leagues[leagueId]?.ruleSet;

  return leagueRuleSet && leagueRuleSet.seasonStartYear <= input.seasonStartYear
    ? leagueRuleSet
    : getLeagueRuleSet(leagueId, input.seasonStartYear);
}

function getRuleSets(input: PromotionRelegationProgressInput) {
  return {
    [K1_LEAGUE_ID]: getRuleSet(input, K1_LEAGUE_ID),
    [K2_LEAGUE_ID]: getRuleSet(input, K2_LEAGUE_ID),
    [K3_LEAGUE_ID]: getRuleSet(input, K3_LEAGUE_ID),
    [K4_LEAGUE_ID]: getRuleSet(input, K4_LEAGUE_ID),
  };
}

function isSpecialBottomClub(ruleSet: League["ruleSet"], clubId?: string): boolean {
  return Boolean(clubId && ruleSet.transitionSpecialCase?.clubIds.includes(clubId));
}

function appendFixtures(existingFixtures: readonly Fixture[], newFixtures: readonly Fixture[]): Fixture[] {
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

function getClubFromLeague(input: PromotionRelegationProgressInput, clubId?: string): Club | undefined {
  if (!clubId) {
    return undefined;
  }

  return Object.values(input.leagues)
    .flatMap((league) => league.clubs)
    .find((club) => club.id === clubId);
}

function getFirstRuleEntrant(input: PromotionRelegationProgressInput, rule: LeagueMovementRule): LeagueTableRow | undefined {
  if (rule.entrantPositionStart && rule.entrantPositionEnd) {
    return rowsInPositionRange(
      input.tables[rule.fromLeagueId] ?? [],
      rule.entrantPositionStart,
      rule.entrantPositionEnd,
    )[0];
  }

  return rowsFromBottom(input.tables[rule.fromLeagueId] ?? [], rule.entrantPositionsFromBottom)[0];
}

function getFirstRuleOpponent(input: PromotionRelegationProgressInput, rule: LeagueMovementRule): LeagueTableRow | undefined {
  if (!rule.opponentLeagueId) {
    return undefined;
  }

  return rowsFromBottom(input.tables[rule.opponentLeagueId] ?? [], rule.opponentPositionsFromBottom)[0];
}

function targetSizeReached(input: PromotionRelegationProgressInput, rule: LeagueMovementRule, projectedAdditions = 0): boolean {
  const targetLeagueId = rule.targetSizeLeagueId ?? rule.opponentLeagueId;

  if (!targetLeagueId) {
    return true;
  }

  const target = input.leagues[targetLeagueId]?.ruleSet.teamCountTargetByLeague[targetLeagueId];
  if (!target) {
    return true;
  }

  return (input.leagues[targetLeagueId]?.clubs.length ?? 0) + projectedAdditions >= target;
}

function eligibilityNote(
  input: PromotionRelegationProgressInput,
  club: Club | undefined,
  rule: LeagueMovementRule,
): string | undefined {
  const eligibility = checkPromotionEligibility(club, rule);

  if (eligibility.eligible) {
    return undefined;
  }

  const labels = eligibility.reasons.map((reason) =>
    reason === "license" ? "라이선스" : "승격 의사",
  );

  return `${clubName(input.tables, club?.id)}은 ${labels.join(", ")} 요건을 충족하지 못했습니다.`;
}

function createInitialStatus(input: PromotionRelegationProgressInput): PromotionRelegationStatus {
  const ruleSets = getRuleSets(input);
  const k1RuleSet = ruleSets[K1_LEAGUE_ID];
  const k2RuleSet = ruleSets[K2_LEAGUE_ID];
  const k3RuleSet = ruleSets[K3_LEAGUE_ID];
  const k4RuleSet = ruleSets[K4_LEAGUE_ID];
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
    specialBottom ? "전환 규칙으로 K1 추가 승강 플레이오프가 생략됩니다." : undefined,
  ].filter((text): text is string => Boolean(text)).join(" / ");

  return {
    seasonNumber: input.seasonNumber,
    seasonStartYear: input.seasonStartYear,
    ruleSetIds: {
      [K1_LEAGUE_ID]: k1RuleSet.id,
      [K2_LEAGUE_ID]: k2RuleSet.id,
      [K3_LEAGUE_ID]: k3RuleSet.id,
      [K4_LEAGUE_ID]: k4RuleSet.id,
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
    promotionRelegationTies: [],
    automaticPromotionClubId: directPromotionClubIds[0],
    promotionPlayoffClubId: promotionPlayoffRows[0]?.clubId,
    automaticRelegationClubId: allDirectRelegationClubIds[0],
    playoffClubId: relegationPlayoffClubIds[0],
    note: note || "승강 규정에 따라 시즌 종료 처리를 준비합니다.",
  };
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

function withTieRecord(
  status: PromotionRelegationStatus,
  record: PromotionRelegationTieRecord,
): PromotionRelegationStatus {
  const existing = status.promotionRelegationTies ?? [];

  return {
    ...status,
    promotionRelegationTies: existing.some((tie) => tie.tieId === record.tieId)
      ? existing
      : [...existing, record],
  };
}

function createLowerPyramidResult(
  input: PromotionRelegationProgressInput,
  result: PromotionRelegationProgressResult,
): PromotionRelegationProgressResult {
  if (result.status.lowerPyramidResolved || result.status.lowerPyramidPlayoffsCreated) {
    return result;
  }

  const ruleSets = getRuleSets(input);
  const promoted: string[] = [...(result.status.promotedClubIds ?? result.status.directPromotionClubIds ?? [])];
  const relegated: string[] = [...(result.status.relegatedClubIds ?? result.status.directRelegationClubIds ?? [])];
  const notes: string[] = [];
  let workingFixtures = [...result.fixtures];
  let workingBracket = result.status.playoffBracket;
  let workingStatus = result.status;
  const addedFixtureIds: string[] = [];
  let projectedK3Additions = 0;

  for (const rule of getRulesByConcept(ruleSets, "directPromotion").filter((candidate) => candidate.fromLeagueId === K4_LEAGUE_ID)) {
    const entrant = getFirstRuleEntrant(input, rule);
    const club = getClubFromLeague(input, entrant?.clubId);
    const ineligibleNote = eligibilityNote(input, club, rule);

    if (!entrant || !club) {
      continue;
    }

    if (ineligibleNote) {
      notes.push(`${ineligibleNote} ${clubName(input.tables, entrant.clubId)}의 자동 승격은 보류됩니다.`);
      continue;
    }

    promoted.push(entrant.clubId);
    projectedK3Additions += rule.toLeagueId === K3_LEAGUE_ID ? 1 : 0;
    notes.push(`${clubName(input.tables, entrant.clubId)}이 승격 요건을 충족해 Division 3으로 승격됩니다.`);
  }

  for (const rule of getRulesByConcept(ruleSets, "promotionPlayoff").filter((candidate) =>
    candidate.fromLeagueId === K3_LEAGUE_ID || candidate.fromLeagueId === K4_LEAGUE_ID,
  )) {
    const entrant = getFirstRuleEntrant(input, rule);
    const opponent = getFirstRuleOpponent(input, rule);
    const entrantClub = getClubFromLeague(input, entrant?.clubId);
    const opponentClub = getClubFromLeague(input, opponent?.clubId);
    const ineligibleNote = eligibilityNote(input, entrantClub, rule);

    if (!entrant || !opponent || !entrantClub || !opponentClub) {
      continue;
    }

    if (ineligibleNote) {
      notes.push(
        rule.fromLeagueId === K3_LEAGUE_ID
          ? `${ineligibleNote} K3-K2 승강 플레이오프와 K2 최하위 강등은 열리지 않습니다.`
          : `${ineligibleNote} K3-K4 승강 플레이오프는 열리지 않습니다.`,
      );
      continue;
    }

    if (
      rule.automaticRelegationSuspendedUntilTarget &&
      !targetSizeReached(input, rule, rule.targetSizeLeagueId === K3_LEAGUE_ID ? projectedK3Additions : 0)
    ) {
      notes.push(`${clubName(input.tables, opponent.clubId)}의 자동 강등은 목표 팀 수 도달 전까지 유예됩니다.`);
      continue;
    }

    const higherClubId = opponent.clubId;
    const lowerClubId = entrant.clubId;
    const hostClubId = rule.host === "lowerDivision" ? lowerClubId : higherClubId;
    const tie = createSingleLegPromotionRelegationTie({
      seasonNumber: input.seasonNumber,
      leagueId: rule.opponentLeagueId ?? rule.toLeagueId ?? rule.fromLeagueId,
      higherDivisionClubId: higherClubId,
      lowerDivisionClubId: lowerClubId,
      hostClubId,
      fixtures: workingFixtures,
      ruleId: rule.id,
      name: rule.id === "k3-champion-vs-k2-bottom" ? "K2-K3 승강 플레이오프" : "K3-K4 승강 플레이오프",
      existingBracket: workingBracket,
    });
    const tieId = tie.fixtures[0]?.playoff?.tieId;

    workingFixtures = appendFixtures(workingFixtures, tie.fixtures);
    workingBracket = mergeBracket(workingBracket, tie.bracket);
    addedFixtureIds.push(...tie.fixtures.map((fixture) => fixture.id));
    if (tieId) {
      workingStatus = withTieRecord(workingStatus, {
        tieId,
        fixtureIds: tie.fixtures.map((fixture) => fixture.id),
        higherLeagueId: rule.opponentLeagueId ?? rule.toLeagueId ?? K2_LEAGUE_ID,
        lowerLeagueId: rule.fromLeagueId,
        higherClubId,
        lowerClubId,
        ruleId: rule.id,
      });
    }
    notes.push(`${clubName(input.tables, lowerClubId)}와 ${clubName(input.tables, higherClubId)}의 단판 승강 플레이오프가 생성됩니다.`);
  }

  const k4ReplacementRule = getNonPlayablePoolReplacementRule(ruleSets[K4_LEAGUE_ID], input.k4K5Mode, input.leagueMode);
  const k4Bottom = rowsFromBottom(input.tables[K4_LEAGUE_ID] ?? [], k4ReplacementRule?.entrantPositionsFromBottom ?? [1])[0];
  if (k4ReplacementRule && k4Bottom) {
    relegated.push(k4Bottom.clubId);
    notes.push(`${clubName(input.tables, k4Bottom.clubId)}이 playable divisions 밖으로 내려가고 5부 풀 팀이 Division 4에 진입합니다.`);
  } else if (k4Bottom) {
    notes.push("현실 모드 규정에 따라 Division 4 자동 강등은 유예됩니다.");
  }

  const baseStatus: PromotionRelegationStatus = {
    ...workingStatus,
    promotedClubIds: unique(promoted),
    relegatedClubIds: unique(relegated),
    playoffBracket: workingBracket,
    playoffFixtureIds: unique([...(workingStatus.playoffFixtureIds ?? []), ...addedFixtureIds]),
    note: unique([workingStatus.note, ...notes]).join(" / "),
  };

  if (addedFixtureIds.length > 0) {
    return {
      fixtures: workingFixtures,
      addedFixtureIds,
      status: {
        ...baseStatus,
        stage: "promotionRelegationPlayoff",
        isResolved: false,
        lowerPyramidPlayoffsCreated: true,
      },
    };
  }

  return {
    fixtures: workingFixtures,
    addedFixtureIds: [],
    status: {
      ...baseStatus,
      stage: "resolved",
      isResolved: true,
      lowerPyramidResolved: true,
    },
  };
}

function resolvedResult(
  input: PromotionRelegationProgressInput,
  result: PromotionRelegationProgressResult,
): PromotionRelegationProgressResult {
  if (!result.status.isResolved && result.status.stage !== "resolved") {
    return result;
  }

  return createLowerPyramidResult(input, result);
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

  const k1RuleSet = getRuleSet(input, K1_LEAGUE_ID);
  const k2RuleSet = getRuleSet(input, K2_LEAGUE_ID);
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
  const tieId = tie.fixtures[0]?.playoff?.tieId;
  const statusWithTie = tieId
    ? withTieRecord(status, {
        tieId,
        fixtureIds: tie.fixtures.map((fixture) => fixture.id),
        higherLeagueId: K1_LEAGUE_ID,
        lowerLeagueId: K2_LEAGUE_ID,
        higherClubId: k1PlayoffClubId,
        lowerClubId: challengerClubId,
        ruleId: k1RuleSet.relegationPlayoffConfig?.id ?? "k1-k2-promotion-relegation",
      })
    : status;

  return {
    fixtures: appendFixtures(input.fixtures, tie.fixtures),
    addedFixtureIds: tie.fixtures.map((fixture) => fixture.id),
    status: {
      ...statusWithTie,
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

  const fixturesByTieId = new Map<string, Fixture[]>();
  const resolvedTieIds = new Set((status.playoffResults ?? []).map((result) => result.id));
  for (const fixture of prFixtures) {
    const tieId = fixture.playoff?.tieId;
    if (!tieId || resolvedTieIds.has(tieId)) {
      continue;
    }
    fixturesByTieId.set(tieId, [...(fixturesByTieId.get(tieId) ?? []), fixture]);
  }

  const resolutions = [...fixturesByTieId.entries()]
    .map(([tieId, fixtures]) => {
      const orderedFixtures = [...fixtures].sort((left, right) => (left.playoff?.leg ?? 0) - (right.playoff?.leg ?? 0));
      const resolution = orderedFixtures[0]?.playoff?.tieFormat === "singleLeg"
        ? resolveSingleLegPlayoffFixture(orderedFixtures[0])
        : resolveTwoLeggedTie(orderedFixtures);

      return resolution ? { tieId, fixtures: orderedFixtures, resolution } : undefined;
    })
    .filter((resolution): resolution is { tieId: string; fixtures: Fixture[]; resolution: PlayoffTieResolution } => Boolean(resolution));

  if (resolutions.length !== fixturesByTieId.size) {
    return undefined;
  }

  const promotedClubIds = [...(status.promotedClubIds ?? status.directPromotionClubIds ?? [])];
  const relegatedClubIds = [...(status.relegatedClubIds ?? status.directRelegationClubIds ?? [])];
  const tieRecords = status.promotionRelegationTies ?? [];
  const playoffResults = [...(status.playoffResults ?? [])];

  for (const { tieId, fixtures, resolution } of resolutions) {
    const tieRecord = tieRecords.find((record) => record.tieId === tieId);

    if (tieRecord && resolution.winnerClubId === tieRecord.lowerClubId) {
      promotedClubIds.push(tieRecord.lowerClubId);
      relegatedClubIds.push(tieRecord.higherClubId);
    }

    playoffResults.push(
      resultToSummary(
        resolution,
        tieRecord?.ruleId === "k3-champion-vs-k2-bottom"
          ? "K2-K3 승강 플레이오프"
          : tieRecord?.ruleId === "k4-second-vs-k3-bottom"
            ? "K3-K4 승강 플레이오프"
            : "승강 플레이오프",
        fixtures,
      ),
    );
  }

  return {
    fixtures: [...input.fixtures],
    addedFixtureIds: [],
    status: {
      ...status,
      stage: "resolved" as const,
      isResolved: true,
      promotedClubIds: unique(promotedClubIds),
      relegatedClubIds: unique(relegatedClubIds),
      lowerPyramidResolved: status.lowerPyramidPlayoffsCreated ? true : status.lowerPyramidResolved,
      playoffResults,
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
    return resolvedResult(input, createInitialPlayoffs(input, status));
  }

  if (status.isResolved || status.stage === "resolved") {
    return resolvedResult(input, {
      fixtures: [...input.fixtures],
      status,
      addedFixtureIds: [],
    });
  }

  const next = status.stage === "promotionPlayoffSemifinals"
    ? resolveSemifinals(input, status)
    : status.stage === "promotionPlayoffFinal"
      ? resolveFinal(input, status)
      : status.stage === "promotionRelegationPlayoff"
        ? resolvePromotionRelegationPlayoff(input, status)
        : undefined;

  return resolvedResult(input, next ?? {
    fixtures: [...input.fixtures],
    status,
    addedFixtureIds: [],
  });
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
