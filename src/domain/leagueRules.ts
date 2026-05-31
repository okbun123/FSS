import type { LeagueRuleSet, LeagueTier, LeagueTableRow } from "./types";

const K1_LEAGUE_ID = "k1_fictional" satisfies LeagueTier;
const K2_LEAGUE_ID = "k2_fictional" satisfies LeagueTier;
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
    teamCountTargetByLeague: {
      [K1_LEAGUE_ID]: 14,
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
    teamCountTargetByLeague: {
      [K1_LEAGUE_ID]: 14,
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
    teamCountTargetByLeague: {
      [K1_LEAGUE_ID]: 14,
    },
  };
}

export function createKLeagueInspired2026TransitionRuleSets(): Record<LeagueTier, LeagueRuleSet> {
  return {
    [K1_LEAGUE_ID]: createK1TransitionRuleSet(),
    [K2_LEAGUE_ID]: createK2TransitionRuleSet(),
  };
}

export function createKLeagueInspired2027DefaultRuleSets(
  options: LeagueRuleOptions = {},
): Record<LeagueTier, LeagueRuleSet> {
  return {
    [K1_LEAGUE_ID]: createK1DefaultRuleSet(),
    [K2_LEAGUE_ID]: createK2DefaultRuleSet(options),
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
