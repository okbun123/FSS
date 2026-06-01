import {
  applyClubMetricCaps,
  CLUB_EVOLUTION_METRICS,
  DEFAULT_CLUB_CAPS,
  type ClubCapsConfig,
  type LeagueMovement,
} from "./clubCaps";
import { getCupResultImpactScore } from "./domesticCup";
import type {
  Club,
  ClubEvolutionCappedChange,
  ClubEvolutionMetric,
  ClubEvolutionResult,
  ClubEvolutionValues,
  ClubSeasonRecord,
  League,
  LeagueTableRow,
  LeagueTier,
  PromotionRelegationStatus,
} from "./types";

export interface ClubEvolutionInput {
  club: Club;
  league: League;
  table: readonly LeagueTableRow[];
  seasonNumber: number;
  movement?: LeagueMovement;
  predictedFinish?: number;
  cupResult?: string;
  continentalResult?: string;
  financialStability?: number;
  capsConfig?: ClubCapsConfig;
}

export interface ApplyClubSeasonEvolutionInput {
  clubs: Record<string, Club>;
  leagues: Record<LeagueTier, League>;
  tables: Record<LeagueTier, LeagueTableRow[]>;
  seasonNumber: number;
  promotionRelegation?: PromotionRelegationStatus;
  cupResults?: Partial<Record<string, string>>;
  continentalResults?: Partial<Record<string, string>>;
  financialStability?: Partial<Record<string, number>>;
  capsConfig?: ClubCapsConfig;
}

export interface ApplyClubSeasonEvolutionResult {
  clubs: Record<string, Club>;
  leagues: Record<LeagueTier, League>;
  results: ClubEvolutionResult[];
}

type MetricDeltas = Record<ClubEvolutionMetric, number>;

const METRIC_LABELS: Record<ClubEvolutionMetric, string> = {
  reputation: "평판",
  budgetLevel: "예산",
  youthOpportunity: "유스 기회",
  squadStrength: "스쿼드 전력",
};

const EMPTY_DELTAS: MetricDeltas = {
  reputation: 0,
  budgetLevel: 0,
  youthOpportunity: 0,
  squadStrength: 0,
};

function addDeltas(target: MetricDeltas, source: Partial<MetricDeltas>): void {
  for (const metric of CLUB_EVOLUTION_METRICS) {
    target[metric] += source[metric] ?? 0;
  }
}

function getEvolutionValues(club: Club): ClubEvolutionValues {
  return {
    reputation: club.reputation,
    budgetLevel: club.budgetLevel,
    youthOpportunity: club.youthOpportunity,
    squadStrength: club.squadStrength,
  };
}

function getFacilitiesAverage(club: Club): number {
  const facilities = club.trainingFacilities;
  const values = [
    facilities.technicalTraining,
    facilities.physicalTraining,
    facilities.tacticalTraining,
    facilities.mentalTraining,
    facilities.youthDevelopment,
    facilities.medicalSupport,
  ];

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function predictionScore(club: Club): number {
  return (
    club.squadStrength * 0.52 +
    club.reputation * 0.24 +
    club.budgetLevel * 0.14 +
    getFacilitiesAverage(club) * 0.1
  );
}

export function predictClubFinish(clubs: readonly Club[], clubId: string): number {
  const predictedTable = [...clubs].sort(
    (left, right) =>
      predictionScore(right) - predictionScore(left) ||
      right.reputation - left.reputation ||
      left.name.localeCompare(right.name, "ko"),
  );

  return predictedTable.findIndex((club) => club.id === clubId) + 1;
}

function getMovement(
  clubId: string,
  promotionRelegation?: PromotionRelegationStatus,
): LeagueMovement {
  if (promotionRelegation?.promotedClubIds?.includes(clubId)) {
    return "promoted";
  }

  if (promotionRelegation?.relegatedClubIds?.includes(clubId)) {
    return "relegated";
  }

  return "stayed";
}

function competitionScore(result?: string): number {
  if (!result) {
    return 0;
  }

  const domesticCupScore = getCupResultImpactScore(result);
  if (domesticCupScore !== 0) {
    return domesticCupScore;
  }

  const normalized = result.toLowerCase();

  if (normalized.includes("winner") || normalized.includes("champion") || result.includes("우승")) {
    return 3;
  }

  if (normalized.includes("semi") || result.includes("4강")) {
    return 1.25;
  }

  if (normalized.includes("quarter") || result.includes("8강")) {
    return 0.7;
  }

  if (normalized.includes("runner") || normalized.includes("final") || result.includes("준우승") || result.includes("결승")) {
    return 2;
  }

  if (normalized.includes("early") || normalized.includes("group") || result.includes("조별") || result.includes("초반")) {
    return -0.5;
  }

  return 0;
}

function getPolicyEffects(policy: string): Partial<MetricDeltas> {
  const normalized = policy.toLowerCase();
  const effects: Partial<MetricDeltas> = {};

  if (
    normalized.includes("academy") ||
    normalized.includes("prospect") ||
    policy.includes("아카데미") ||
    policy.includes("유망주") ||
    policy.includes("신인") ||
    policy.includes("육성")
  ) {
    effects.youthOpportunity = (effects.youthOpportunity ?? 0) + 0.8;
    effects.squadStrength = (effects.squadStrength ?? 0) + 0.2;
  }

  if (
    normalized.includes("data") ||
    normalized.includes("loan") ||
    policy.includes("데이터") ||
    policy.includes("임대") ||
    policy.includes("자유계약") ||
    policy.includes("저비용") ||
    policy.includes("저평가") ||
    policy.includes("실속") ||
    policy.includes("재판매")
  ) {
    effects.budgetLevel = (effects.budgetLevel ?? 0) + 0.4;
    effects.youthOpportunity = (effects.youthOpportunity ?? 0) + 0.2;
  }

  if (
    normalized.includes("star") ||
    policy.includes("스타") ||
    policy.includes("즉시") ||
    policy.includes("검증") ||
    policy.includes("우승")
  ) {
    effects.reputation = (effects.reputation ?? 0) + 0.2;
    effects.squadStrength = (effects.squadStrength ?? 0) + 0.7;
    effects.budgetLevel = (effects.budgetLevel ?? 0) - 0.2;
  }

  return effects;
}

function getAgingEffects(averageAge?: number): Partial<MetricDeltas> {
  if (averageAge === undefined) {
    return {};
  }

  if (averageAge >= 29) {
    return {
      budgetLevel: -0.2,
      youthOpportunity: 0.3,
      squadStrength: -1.1,
    };
  }

  if (averageAge <= 24) {
    return {
      youthOpportunity: 0.8,
      squadStrength: 0.6,
    };
  }

  return {};
}

function inferFinancialStability(club: Club, explicit?: number): number {
  if (explicit !== undefined) {
    return Math.max(-1, Math.min(1, explicit));
  }

  if (club.budgetLevel >= 80) {
    return 0.6;
  }

  if (club.budgetLevel >= 68) {
    return 0.3;
  }

  if (club.budgetLevel <= 35) {
    return -0.7;
  }

  if (club.budgetLevel <= 45) {
    return -0.35;
  }

  return 0;
}

function buildPerformanceDeltas(input: ClubEvolutionInput, reasons: string[]): MetricDeltas {
  const deltas: MetricDeltas = { ...EMPTY_DELTAS };
  const row = input.table.find((candidate) => candidate.clubId === input.club.id);
  const teamCount = Math.max(input.table.length, input.league.clubs.length, 1);
  const actualPosition = row?.position ?? teamCount;
  const predictedFinish = input.predictedFinish ?? predictClubFinish(input.league.clubs, input.club.id);
  const levelScale = input.league.level <= 1 ? 1 : 0.68;
  const standingScore = teamCount > 1
    ? (teamCount + 1 - actualPosition * 2) / (teamCount - 1)
    : 0;
  const expectationDelta = predictedFinish > 0 ? predictedFinish - actualPosition : 0;

  addDeltas(deltas, {
    reputation: standingScore * 2.2 * levelScale + expectationDelta * 0.42 * levelScale,
    budgetLevel: standingScore * 1.3 * levelScale + expectationDelta * 0.22 * levelScale,
    youthOpportunity: expectationDelta * 0.12 * levelScale,
    squadStrength: standingScore * 1.9 * levelScale + expectationDelta * 0.24 * levelScale,
  });

  if (actualPosition === 1) {
    addDeltas(deltas, {
      reputation: 1.8 * levelScale,
      budgetLevel: 1.1 * levelScale,
      squadStrength: 1.3 * levelScale,
      youthOpportunity: 0.3,
    });
    reasons.push(`${input.league.name} 우승으로 평판과 전력이 상승했습니다.`);
  } else if (actualPosition <= Math.ceil(teamCount / 3)) {
    addDeltas(deltas, {
      reputation: 0.6 * levelScale,
      budgetLevel: 0.4 * levelScale,
      squadStrength: 0.4 * levelScale,
    });
    reasons.push(`${input.league.name} 상위권 성적으로 안정적인 성장을 얻었습니다.`);
  } else if (actualPosition > Math.floor(teamCount * 0.75)) {
    addDeltas(deltas, {
      reputation: -0.9 * levelScale,
      budgetLevel: -0.6 * levelScale,
      squadStrength: -0.7 * levelScale,
    });
    reasons.push(`${input.league.name} 하위권 마감으로 일부 지표가 조정됐습니다.`);
  }

  if (expectationDelta >= 3) {
    reasons.push(`예상보다 ${expectationDelta}계단 높은 순위로 마쳐 성장 폭이 커졌습니다.`);
  } else if (expectationDelta <= -3) {
    reasons.push(`예상보다 ${Math.abs(expectationDelta)}계단 낮은 순위로 마쳐 성장 폭이 줄었습니다.`);
  }

  if (input.movement === "promoted") {
    addDeltas(deltas, {
      reputation: 1.4,
      budgetLevel: 1,
      youthOpportunity: 0.3,
      squadStrength: 0.8,
    });
    reasons.push("승격 보너스가 적용됐지만 1부 하위-중위권 기준으로 제한됩니다.");
  } else if (input.movement === "relegated") {
    addDeltas(deltas, {
      reputation: -2.4,
      budgetLevel: -1.4,
      youthOpportunity: 0.5,
      squadStrength: -1.2,
    });
    reasons.push("강등 영향으로 평판과 예산이 낮아졌지만 급락은 제한됩니다.");
  }

  const cupScore = competitionScore(input.cupResult);
  if (cupScore !== 0) {
    addDeltas(deltas, {
      reputation: cupScore * 0.35,
      budgetLevel: cupScore * 0.2,
      squadStrength: cupScore * 0.12,
    });
    reasons.push(cupScore > 0 ? "컵 대회 성과가 평판에 반영됐습니다." : "컵 대회 부진이 소폭 반영됐습니다.");
  }

  const continentalScore = competitionScore(input.continentalResult);
  if (continentalScore !== 0) {
    addDeltas(deltas, {
      reputation: continentalScore * 0.65,
      budgetLevel: continentalScore * 0.35,
      squadStrength: continentalScore * 0.2,
    });
    reasons.push(
      continentalScore > 0
        ? "대륙 대회 성과로 외부 평가가 좋아졌습니다."
        : "대륙 대회 부진이 소폭 반영됐습니다.",
    );
  }

  const agingEffects = getAgingEffects(input.club.squadSummary?.averageAge);
  addDeltas(deltas, agingEffects);

  if ((agingEffects.squadStrength ?? 0) < 0) {
    reasons.push("선수단 평균 연령이 높아 전력 성장이 둔화됐습니다.");
  } else if ((agingEffects.youthOpportunity ?? 0) > 0) {
    reasons.push("젊은 선수단 구조가 유스 기회와 전력 성장에 도움을 줬습니다.");
  }

  const policyEffects = getPolicyEffects(input.club.transferPolicy ?? "");
  addDeltas(deltas, policyEffects);

  if (Object.values(policyEffects).some((value) => Math.abs(value ?? 0) > 0)) {
    reasons.push("이적 정책 성향이 예산, 유스, 전력 변화에 반영됐습니다.");
  }

  const financialStability = inferFinancialStability(input.club, input.financialStability);
  addDeltas(deltas, {
    budgetLevel: financialStability * 1.1,
    squadStrength: financialStability * 0.35,
  });

  if (financialStability >= 0.5) {
    reasons.push("재정 안정성이 다음 시즌 투자 여력을 높였습니다.");
  } else if (financialStability <= -0.5) {
    reasons.push("재정 압박으로 예산 성장에 제약이 생겼습니다.");
  }

  return deltas;
}

export function evolveClubForSeason(input: ClubEvolutionInput): ClubEvolutionResult {
  const reasons: string[] = [];
  const oldValues = getEvolutionValues(input.club);
  const requestedDeltas = buildPerformanceDeltas(input, reasons);
  const cappedChanges: ClubEvolutionCappedChange[] = [];
  const newValues = CLUB_EVOLUTION_METRICS.reduce<ClubEvolutionValues>((values, metric) => {
    const capped = applyClubMetricCaps({
      leagueId: input.league.id,
      metric,
      oldValue: oldValues[metric],
      requestedDelta: requestedDeltas[metric],
      movement: input.movement,
      config: input.capsConfig ?? DEFAULT_CLUB_CAPS,
    });

    values[metric] = capped.newValue;

    if (capped.wasCapped) {
      cappedChanges.push({
        metric,
        requestedDelta: capped.requestedDelta,
        appliedDelta: capped.appliedDelta,
        oldValue: capped.oldValue,
        newValue: capped.newValue,
        min: capped.min,
        max: capped.max,
        maxIncrease: capped.maxIncrease,
        maxDecrease: capped.maxDecrease,
      });
      reasons.push(`${METRIC_LABELS[metric]} 변화가 리그별 제한으로 ${capped.appliedDelta >= 0 ? "+" : ""}${capped.appliedDelta}에 묶였습니다.`);
    }

    return values;
  }, { ...oldValues });

  if (reasons.length === 0) {
    reasons.push("시즌 성과가 기존 평가와 비슷해 큰 변화는 없었습니다.");
  }

  return {
    clubId: input.club.id,
    seasonNumber: input.seasonNumber,
    oldValues,
    newValues,
    reasons,
    cappedChanges,
  };
}

function createSeasonRecord(input: {
  club: Club;
  row?: LeagueTableRow;
  seasonNumber: number;
  movement: LeagueMovement;
  predictedFinish: number;
  evolution: ClubEvolutionResult;
  cupResult?: string;
  continentalResult?: string;
}): ClubSeasonRecord {
  return {
    seasonNumber: input.seasonNumber,
    leagueId: input.club.leagueId,
    leaguePosition: input.row?.position ?? input.predictedFinish,
    predictedFinish: input.predictedFinish,
    points: input.row?.points ?? 0,
    goalsFor: input.row?.goalsFor ?? 0,
    goalsAgainst: input.row?.goalsAgainst ?? 0,
    reputation: input.evolution.newValues.reputation,
    budgetLevel: input.evolution.newValues.budgetLevel,
    youthOpportunity: input.evolution.newValues.youthOpportunity,
    squadStrength: input.evolution.newValues.squadStrength,
    leagueMovement: input.movement,
    cupResult: input.cupResult,
    continentalResult: input.continentalResult,
  };
}

function applyEvolutionToClub(
  club: Club,
  evolution: ClubEvolutionResult,
  seasonRecord: ClubSeasonRecord,
): Club {
  const seasonRecords = [
    ...club.seasonRecords.filter((record) => record.seasonNumber !== seasonRecord.seasonNumber),
    seasonRecord,
  ].sort((left, right) => left.seasonNumber - right.seasonNumber);

  return {
    ...club,
    reputation: evolution.newValues.reputation,
    budgetLevel: evolution.newValues.budgetLevel,
    youthOpportunity: evolution.newValues.youthOpportunity,
    squadStrength: evolution.newValues.squadStrength,
    strength: evolution.newValues.squadStrength,
    squadLevel: evolution.newValues.squadStrength,
    squadSummary: {
      ...club.squadSummary,
      averageOvr: evolution.newValues.squadStrength,
    },
    seasonRecords,
    lastEvolution: evolution,
  };
}

export function applyClubSeasonEvolution(
  input: ApplyClubSeasonEvolutionInput,
): ApplyClubSeasonEvolutionResult {
  const updatedEntries = Object.values(input.clubs).map((club) => {
    const league = input.leagues[club.leagueId];
    const table = input.tables[club.leagueId] ?? [];
    const row = table.find((candidate) => candidate.clubId === club.id);
    const movement = getMovement(club.id, input.promotionRelegation);
    const predictedFinish = predictClubFinish(league.clubs.map((leagueClub) => input.clubs[leagueClub.id] ?? leagueClub), club.id);
    const evolution = evolveClubForSeason({
      club,
      league,
      table,
      seasonNumber: input.seasonNumber,
      movement,
      predictedFinish,
      cupResult: input.cupResults?.[club.id],
      continentalResult: input.continentalResults?.[club.id],
      financialStability: input.financialStability?.[club.id],
      capsConfig: input.capsConfig,
    });
    const seasonRecord = createSeasonRecord({
      club,
      row,
      seasonNumber: input.seasonNumber,
      movement,
      predictedFinish,
      evolution,
      cupResult: input.cupResults?.[club.id],
      continentalResult: input.continentalResults?.[club.id],
    });

    return [club.id, applyEvolutionToClub(club, evolution, seasonRecord), evolution] as const;
  });
  const clubs = Object.fromEntries(updatedEntries.map(([clubId, club]) => [clubId, club]));
  const leagues = Object.fromEntries(
    Object.entries(input.leagues).map(([leagueId, league]) => [
      leagueId,
      {
        ...league,
        clubs: league.clubs.map((club) => clubs[club.id] ?? club),
      },
    ]),
  ) as Record<LeagueTier, League>;

  return {
    clubs,
    leagues,
    results: updatedEntries.map(([, , result]) => result),
  };
}
