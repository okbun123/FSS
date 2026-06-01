import type {
  K4K5Mode,
  LeagueMovementRule,
  LeagueRuleConcept,
  LeagueRuleSet,
  LeagueTier,
  LeagueTableRow,
} from "./types";
import {
  K1_LEAGUE_ID,
  K2_LEAGUE_ID,
  K3_LEAGUE_ID,
  K4_LEAGUE_ID,
} from "./leagueIds";
import { resolveK4K5Mode, type LegacyLeagueMode } from "./k4K5Mode";

const SPECIAL_TRANSITION_CLUB_IDS = ["gimcheon-garam-phoenix"];

export interface LeagueRuleOptions {
  k2PromotionPlayoffRange?: readonly [number, number];
}

const BASE_RULES = {
  pointsForWin: 3,
  pointsForDraw: 1,
  pointsForLoss: 0,
  tableTiebreakers: ["points", "goalDifference", "goalsFor", "wins", "clubName"] as LeagueRuleSet["tableTiebreakers"],
};

function directPromotionRule(input: {
  id: string;
  fromLeagueId: LeagueTier;
  toLeagueId: LeagueTier;
  slots: number;
  licensingRequired?: boolean;
  promotionIntentRequired?: boolean;
}): LeagueMovementRule {
  return {
    id: input.id,
    concept: "directPromotion",
    fromLeagueId: input.fromLeagueId,
    toLeagueId: input.toLeagueId,
    entrantPositionStart: 1,
    entrantPositionEnd: input.slots,
    licensingRequired: input.licensingRequired,
    promotionIntentRequired: input.promotionIntentRequired,
  };
}

function directRelegationRule(input: {
  id: string;
  fromLeagueId: LeagueTier;
  toLeagueId?: LeagueTier;
  positionsFromBottom: number[];
  automaticRelegationSuspended?: boolean;
  automaticRelegationSuspendedUntilTarget?: boolean;
  nonPlayablePoolReplacement?: boolean;
  appliesWhenK4K5Mode?: K4K5Mode;
}): LeagueMovementRule {
  return {
    id: input.id,
    concept: input.nonPlayablePoolReplacement ? "nonPlayablePoolReplacement" : "directRelegation",
    fromLeagueId: input.fromLeagueId,
    toLeagueId: input.toLeagueId,
    entrantPositionsFromBottom: input.positionsFromBottom,
    automaticRelegationSuspended: input.automaticRelegationSuspended,
    automaticRelegationSuspendedUntilTarget: input.automaticRelegationSuspendedUntilTarget,
    nonPlayablePoolReplacement: input.nonPlayablePoolReplacement,
    appliesWhenK4K5Mode: input.appliesWhenK4K5Mode,
  };
}

function promotionPlayoffRule(input: {
  id: string;
  fromLeagueId: LeagueTier;
  toLeagueId: LeagueTier;
  opponentLeagueId: LeagueTier;
  entrantPositionStart: number;
  entrantPositionEnd: number;
  opponentPositionsFromBottom: number[];
  tieFormat: "singleLeg" | "twoLegged";
  host: LeagueMovementRule["host"];
  licensingRequired?: boolean;
  promotionIntentRequired?: boolean;
  automaticRelegationSuspendedUntilTarget?: boolean;
  targetSizeLeagueId?: LeagueTier;
}): LeagueMovementRule {
  return {
    id: input.id,
    concept: "promotionPlayoff",
    fromLeagueId: input.fromLeagueId,
    toLeagueId: input.toLeagueId,
    opponentLeagueId: input.opponentLeagueId,
    entrantPositionStart: input.entrantPositionStart,
    entrantPositionEnd: input.entrantPositionEnd,
    opponentPositionsFromBottom: input.opponentPositionsFromBottom,
    tieFormat: input.tieFormat,
    host: input.host,
    licensingRequired: input.licensingRequired,
    promotionIntentRequired: input.promotionIntentRequired,
    automaticRelegationSuspendedUntilTarget: input.automaticRelegationSuspendedUntilTarget,
    targetSizeLeagueId: input.targetSizeLeagueId,
  };
}

function createK1TransitionRuleSet(): LeagueRuleSet {
  return {
    ...BASE_RULES,
    id: "kLeagueInspired2026Transition-k1",
    seasonStartYear: 2026,
    leagueId: K1_LEAGUE_ID,
    roundRobinCycles: 3,
    directPromotionSlots: 0,
    directRelegationSlots: 0,
    relegationPlayoffConfig: {
      id: "k1-bottom-vs-k2-final-loser",
      stage: "promotionRelegationPlayoff",
      entrantPositionsFromBottom: [1],
      tieFormat: "twoLegged",
      higherSeedHosts: true,
      drawAdvantage: "none",
    },
    transitionSpecialCase: {
      id: "militaryCivicTransition",
      clubIds: SPECIAL_TRANSITION_CLUB_IDS,
      ifBottomSkipsRelegationPlayoff: true,
      bottomClubDirectRelegation: true,
    },
    movementRules: [
      promotionPlayoffRule({
        id: "k1-bottom-vs-k2-final-loser",
        fromLeagueId: K2_LEAGUE_ID,
        toLeagueId: K1_LEAGUE_ID,
        opponentLeagueId: K1_LEAGUE_ID,
        entrantPositionStart: 1,
        entrantPositionEnd: 1,
        opponentPositionsFromBottom: [1],
        tieFormat: "twoLegged",
        host: "higherDivision",
      }),
    ],
    teamCountTargetByLeague: {
      [K1_LEAGUE_ID]: 14,
    },
  };
}

function createK2TransitionRuleSet(): LeagueRuleSet {
  return {
    ...BASE_RULES,
    id: "kLeagueInspired2026Transition-k2",
    seasonStartYear: 2026,
    leagueId: K2_LEAGUE_ID,
    roundRobinCycles: 2,
    directPromotionSlots: 2,
    directRelegationSlots: 0,
    promotionPlayoffConfig: {
      id: "k2-3-to-6-promotion-playoff",
      stage: "promotionPlayoffSemifinals",
      entrantPositionStart: 3,
      entrantPositionEnd: 6,
      bracketType: "seededSemifinals",
      tieFormat: "singleLeg",
      higherSeedHosts: true,
      drawAdvantage: "higherSeed",
    },
    movementRules: [
      directPromotionRule({
        id: "k2-top-two-direct-promotion",
        fromLeagueId: K2_LEAGUE_ID,
        toLeagueId: K1_LEAGUE_ID,
        slots: 2,
      }),
      promotionPlayoffRule({
        id: "k2-3-to-6-promotion-playoff",
        fromLeagueId: K2_LEAGUE_ID,
        toLeagueId: K1_LEAGUE_ID,
        opponentLeagueId: K1_LEAGUE_ID,
        entrantPositionStart: 3,
        entrantPositionEnd: 6,
        opponentPositionsFromBottom: [1],
        tieFormat: "singleLeg",
        host: "higherSeed",
      }),
    ],
    teamCountTargetByLeague: {
      [K1_LEAGUE_ID]: 14,
      [K2_LEAGUE_ID]: 17,
    },
  };
}

function createK3RuleSet(seasonStartYear: number): LeagueRuleSet {
  return {
    ...BASE_RULES,
    id: `koreaPyramid${seasonStartYear}-k3`,
    seasonStartYear,
    leagueId: K3_LEAGUE_ID,
    roundRobinCycles: 2,
    directPromotionSlots: 0,
    directRelegationSlots: 0,
    promotionPlayoffConfig: {
      id: "k3-champion-vs-k2-bottom",
      stage: "promotionRelegationPlayoff",
      entrantPositionStart: 1,
      entrantPositionEnd: 1,
      bracketType: "finalOnly",
      tieFormat: "singleLeg",
      higherSeedHosts: false,
      drawAdvantage: "none",
    },
    relegationPlayoffConfig: {
      id: "k3-bottom-vs-k4-second",
      stage: "promotionRelegationPlayoff",
      entrantPositionsFromBottom: [1],
      tieFormat: "singleLeg",
      higherSeedHosts: true,
      drawAdvantage: "none",
    },
    movementRules: [
      promotionPlayoffRule({
        id: "k3-champion-vs-k2-bottom",
        fromLeagueId: K3_LEAGUE_ID,
        toLeagueId: K2_LEAGUE_ID,
        opponentLeagueId: K2_LEAGUE_ID,
        entrantPositionStart: 1,
        entrantPositionEnd: 1,
        opponentPositionsFromBottom: [1],
        tieFormat: "singleLeg",
        host: "higherDivision",
        licensingRequired: true,
      }),
      {
        id: "k3-relegation-suspended-until-target-size",
        concept: "automaticRelegationSuspended",
        fromLeagueId: K3_LEAGUE_ID,
        toLeagueId: K4_LEAGUE_ID,
        automaticRelegationSuspended: true,
        automaticRelegationSuspendedUntilTarget: true,
        targetSizeLeagueId: K3_LEAGUE_ID,
      },
    ],
    teamCountTargetByLeague: {
      [K3_LEAGUE_ID]: 16,
    },
  };
}

function createK4RuleSet(seasonStartYear: number): LeagueRuleSet {
  return {
    ...BASE_RULES,
    id: `koreaPyramid${seasonStartYear}-k4`,
    seasonStartYear,
    leagueId: K4_LEAGUE_ID,
    roundRobinCycles: 2,
    directPromotionSlots: 1,
    directRelegationSlots: 1,
    promotionPlayoffConfig: {
      id: "k4-second-vs-k3-bottom",
      stage: "promotionRelegationPlayoff",
      entrantPositionStart: 2,
      entrantPositionEnd: 2,
      bracketType: "finalOnly",
      tieFormat: "singleLeg",
      higherSeedHosts: false,
      drawAdvantage: "none",
    },
    movementRules: [
      directPromotionRule({
        id: "k4-champion-direct-promotion",
        fromLeagueId: K4_LEAGUE_ID,
        toLeagueId: K3_LEAGUE_ID,
        slots: 1,
        licensingRequired: true,
        promotionIntentRequired: true,
      }),
      promotionPlayoffRule({
        id: "k4-second-vs-k3-bottom",
        fromLeagueId: K4_LEAGUE_ID,
        toLeagueId: K3_LEAGUE_ID,
        opponentLeagueId: K3_LEAGUE_ID,
        entrantPositionStart: 2,
        entrantPositionEnd: 2,
        opponentPositionsFromBottom: [1],
        tieFormat: "singleLeg",
        host: "higherDivision",
        licensingRequired: true,
        promotionIntentRequired: true,
        automaticRelegationSuspendedUntilTarget: true,
        targetSizeLeagueId: K3_LEAGUE_ID,
      }),
      directRelegationRule({
        id: "k4-bottom-to-k5-gameplay",
        fromLeagueId: K4_LEAGUE_ID,
        positionsFromBottom: [1],
        nonPlayablePoolReplacement: true,
        appliesWhenK4K5Mode: "gameplay_relegation_enabled",
      }),
      {
        id: "k4-bottom-relegation-realistic-suspension",
        concept: "automaticRelegationSuspended",
        fromLeagueId: K4_LEAGUE_ID,
        automaticRelegationSuspended: true,
        appliesWhenK4K5Mode: "realistic_suspended",
      },
    ],
    teamCountTargetByLeague: {
      [K4_LEAGUE_ID]: 18,
    },
  };
}

function createK1DefaultRuleSet(): LeagueRuleSet {
  return {
    ...BASE_RULES,
    id: "kLeagueInspired2027Default-k1",
    seasonStartYear: 2027,
    leagueId: K1_LEAGUE_ID,
    roundRobinCycles: 3,
    directPromotionSlots: 0,
    directRelegationSlots: 1,
    relegationPlayoffConfig: {
      id: "k1-second-bottom-promotion-relegation-playoff",
      stage: "promotionRelegationPlayoff",
      entrantPositionsFromBottom: [2],
      tieFormat: "twoLegged",
      higherSeedHosts: true,
      drawAdvantage: "none",
    },
    movementRules: [
      directRelegationRule({
        id: "k1-bottom-direct-relegation",
        fromLeagueId: K1_LEAGUE_ID,
        toLeagueId: K2_LEAGUE_ID,
        positionsFromBottom: [1],
      }),
      promotionPlayoffRule({
        id: "k1-second-bottom-promotion-relegation-playoff",
        fromLeagueId: K2_LEAGUE_ID,
        toLeagueId: K1_LEAGUE_ID,
        opponentLeagueId: K1_LEAGUE_ID,
        entrantPositionStart: 1,
        entrantPositionEnd: 1,
        opponentPositionsFromBottom: [2],
        tieFormat: "twoLegged",
        host: "higherDivision",
      }),
    ],
    teamCountTargetByLeague: {
      [K1_LEAGUE_ID]: 14,
      [K2_LEAGUE_ID]: 17,
    },
  };
}

function createK2DefaultRuleSet(options: LeagueRuleOptions = {}): LeagueRuleSet {
  const [entrantPositionStart, entrantPositionEnd] = options.k2PromotionPlayoffRange ?? [2, 5];

  return {
    ...BASE_RULES,
    id: "kLeagueInspired2027Default-k2",
    seasonStartYear: 2027,
    leagueId: K2_LEAGUE_ID,
    roundRobinCycles: 2,
    directPromotionSlots: 1,
    directRelegationSlots: 0,
    promotionPlayoffConfig: {
      id: `k2-${entrantPositionStart}-to-${entrantPositionEnd}-promotion-playoff`,
      stage: "promotionPlayoffSemifinals",
      entrantPositionStart,
      entrantPositionEnd,
      bracketType: "seededSemifinals",
      tieFormat: "singleLeg",
      higherSeedHosts: true,
      drawAdvantage: "higherSeed",
    },
    movementRules: [
      directPromotionRule({
        id: "k2-champion-direct-promotion",
        fromLeagueId: K2_LEAGUE_ID,
        toLeagueId: K1_LEAGUE_ID,
        slots: 1,
      }),
      promotionPlayoffRule({
        id: `k2-${entrantPositionStart}-to-${entrantPositionEnd}-promotion-playoff`,
        fromLeagueId: K2_LEAGUE_ID,
        toLeagueId: K1_LEAGUE_ID,
        opponentLeagueId: K1_LEAGUE_ID,
        entrantPositionStart,
        entrantPositionEnd,
        opponentPositionsFromBottom: [2],
        tieFormat: "singleLeg",
        host: "higherSeed",
      }),
    ],
    teamCountTargetByLeague: {
      [K1_LEAGUE_ID]: 14,
      [K2_LEAGUE_ID]: 17,
    },
  };
}

export function createKLeagueInspired2026TransitionRuleSets(): Record<LeagueTier, LeagueRuleSet> {
  return {
    [K1_LEAGUE_ID]: createK1TransitionRuleSet(),
    [K2_LEAGUE_ID]: createK2TransitionRuleSet(),
    [K3_LEAGUE_ID]: createK3RuleSet(2026),
    [K4_LEAGUE_ID]: createK4RuleSet(2026),
  };
}

export function createKLeagueInspired2027DefaultRuleSets(
  options: LeagueRuleOptions = {},
): Record<LeagueTier, LeagueRuleSet> {
  return {
    [K1_LEAGUE_ID]: createK1DefaultRuleSet(),
    [K2_LEAGUE_ID]: createK2DefaultRuleSet(options),
    [K3_LEAGUE_ID]: createK3RuleSet(2027),
    [K4_LEAGUE_ID]: createK4RuleSet(2027),
  };
}

export const kLeagueInspired2026Transition = createKLeagueInspired2026TransitionRuleSets();
export const kLeagueInspired2027Default = createKLeagueInspired2027DefaultRuleSets();

export function getLeagueRuleSetsForSeason(
  seasonStartYear: number,
  options: LeagueRuleOptions = {},
): Record<LeagueTier, LeagueRuleSet> {
  if (seasonStartYear <= 2026) {
    return createKLeagueInspired2026TransitionRuleSets();
  }

  return createKLeagueInspired2027DefaultRuleSets(options);
}

export function getLeagueRuleSet(
  leagueId: LeagueTier,
  seasonStartYear: number,
  options: LeagueRuleOptions = {},
): LeagueRuleSet {
  return getLeagueRuleSetsForSeason(seasonStartYear, options)[leagueId];
}

export function getMovementRules(
  ruleSet: LeagueRuleSet,
  concept?: LeagueRuleConcept,
): LeagueMovementRule[] {
  const rules = ruleSet.movementRules ?? [];
  return concept ? rules.filter((rule) => rule.concept === concept) : [...rules];
}

export function getRulesByConcept(
  ruleSets: Record<LeagueTier, LeagueRuleSet>,
  concept: LeagueRuleConcept,
): LeagueMovementRule[] {
  return Object.values(ruleSets).flatMap((ruleSet) => getMovementRules(ruleSet, concept));
}

export function getNonPlayablePoolReplacementRule(
  ruleSet: LeagueRuleSet,
  k4K5Mode?: K4K5Mode,
  legacyLeagueMode?: LegacyLeagueMode,
): LeagueMovementRule | undefined {
  const mode = resolveK4K5Mode(k4K5Mode, legacyLeagueMode);

  return getMovementRules(ruleSet).find(
    (rule) =>
      rule.concept === "nonPlayablePoolReplacement" &&
      rule.nonPlayablePoolReplacement &&
      (!rule.appliesWhenK4K5Mode || rule.appliesWhenK4K5Mode === mode),
  );
}

export function isAutomaticRelegationSuspended(
  ruleSet: LeagueRuleSet,
  k4K5Mode?: K4K5Mode,
  legacyLeagueMode?: LegacyLeagueMode,
): boolean {
  const mode = resolveK4K5Mode(k4K5Mode, legacyLeagueMode);

  return getMovementRules(ruleSet, "automaticRelegationSuspended").some(
    (rule) => !rule.appliesWhenK4K5Mode || rule.appliesWhenK4K5Mode === mode,
  );
}

export type LeagueTableZone =
  | "directPromotion"
  | "promotionPlayoff"
  | "relegationPlayoff"
  | "directRelegation"
  | "none";

export function getLeagueTableZone(
  ruleSet: LeagueRuleSet,
  row: LeagueTableRow,
  totalClubs: number,
): LeagueTableZone {
  if (ruleSet.directPromotionSlots > 0 && row.position <= ruleSet.directPromotionSlots) {
    return "directPromotion";
  }

  const promotionConfig = ruleSet.promotionPlayoffConfig;
  if (
    promotionConfig?.entrantPositionStart &&
    promotionConfig.entrantPositionEnd &&
    row.position >= promotionConfig.entrantPositionStart &&
    row.position <= promotionConfig.entrantPositionEnd
  ) {
    return "promotionPlayoff";
  }

  if (ruleSet.directRelegationSlots > 0 && row.position > totalClubs - ruleSet.directRelegationSlots) {
    return "directRelegation";
  }

  const relegationConfig = ruleSet.relegationPlayoffConfig;
  if (
    relegationConfig?.entrantPositionsFromBottom?.some(
      (positionFromBottom) => row.position === totalClubs - positionFromBottom + 1,
    )
  ) {
    return "relegationPlayoff";
  }

  return "none";
}

export function getZoneLabel(zone: LeagueTableZone): string {
  switch (zone) {
    case "directPromotion":
      return "직행 승격";
    case "promotionPlayoff":
      return "승격 PO";
    case "relegationPlayoff":
      return "강등 PO";
    case "directRelegation":
      return "직행 강등";
    case "none":
    default:
      return "-";
  }
}
