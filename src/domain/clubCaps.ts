import type { ClubEvolutionMetric, LeagueTier } from "./types";

export interface ClubMetricCaps {
  min: number;
  max: number;
  maxIncrease: number;
  maxDecrease: number;
}

export interface ClubLeagueCaps {
  leagueId: LeagueTier;
  metrics: Record<ClubEvolutionMetric, ClubMetricCaps>;
  promotedMax?: Partial<Record<ClubEvolutionMetric, number>>;
}

export type ClubCapsConfig = Record<LeagueTier, ClubLeagueCaps>;

export type LeagueMovement = "promoted" | "relegated" | "stayed";

export interface CappedMetricChange {
  metric: ClubEvolutionMetric;
  requestedDelta: number;
  appliedDelta: number;
  oldValue: number;
  newValue: number;
  min: number;
  max: number;
  maxIncrease: number;
  maxDecrease: number;
  wasCapped: boolean;
}

export const CLUB_EVOLUTION_METRICS: readonly ClubEvolutionMetric[] = [
  "reputation",
  "budgetLevel",
  "youthOpportunity",
  "squadStrength",
];

export const K1_LEAGUE_ID = "k1_fictional" satisfies LeagueTier;
export const K2_LEAGUE_ID = "k2_fictional" satisfies LeagueTier;
export const K3_LEAGUE_ID = "k3_fictional" satisfies LeagueTier;
export const K4_LEAGUE_ID = "k4_fictional" satisfies LeagueTier;

export const PROMOTED_LOWER_MID_K1_CAPS: Partial<Record<ClubEvolutionMetric, number>> = {
  reputation: 68,
  budgetLevel: 62,
  squadStrength: 66,
};

export const DEFAULT_CLUB_CAPS: ClubCapsConfig = {
  [K1_LEAGUE_ID]: {
    leagueId: K1_LEAGUE_ID,
    metrics: {
      reputation: { min: 55, max: 95, maxIncrease: 5, maxDecrease: 6 },
      budgetLevel: { min: 45, max: 95, maxIncrease: 4, maxDecrease: 5 },
      youthOpportunity: { min: 40, max: 92, maxIncrease: 4, maxDecrease: 4 },
      squadStrength: { min: 55, max: 90, maxIncrease: 5, maxDecrease: 6 },
    },
  },
  [K2_LEAGUE_ID]: {
    leagueId: K2_LEAGUE_ID,
    metrics: {
      reputation: { min: 30, max: 72, maxIncrease: 3, maxDecrease: 4 },
      budgetLevel: { min: 20, max: 65, maxIncrease: 2, maxDecrease: 3 },
      youthOpportunity: { min: 45, max: 95, maxIncrease: 3, maxDecrease: 3 },
      squadStrength: { min: 38, max: 68, maxIncrease: 3, maxDecrease: 4 },
    },
    promotedMax: PROMOTED_LOWER_MID_K1_CAPS,
  },
  [K3_LEAGUE_ID]: {
    leagueId: K3_LEAGUE_ID,
    metrics: {
      reputation: { min: 22, max: 58, maxIncrease: 3, maxDecrease: 4 },
      budgetLevel: { min: 16, max: 52, maxIncrease: 2, maxDecrease: 3 },
      youthOpportunity: { min: 38, max: 88, maxIncrease: 3, maxDecrease: 3 },
      squadStrength: { min: 30, max: 58, maxIncrease: 3, maxDecrease: 4 },
    },
  },
  [K4_LEAGUE_ID]: {
    leagueId: K4_LEAGUE_ID,
    metrics: {
      reputation: { min: 14, max: 46, maxIncrease: 3, maxDecrease: 4 },
      budgetLevel: { min: 10, max: 42, maxIncrease: 2, maxDecrease: 3 },
      youthOpportunity: { min: 32, max: 84, maxIncrease: 3, maxDecrease: 3 },
      squadStrength: { min: 22, max: 48, maxIncrease: 3, maxDecrease: 4 },
    },
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getLeagueClubCaps(
  leagueId: LeagueTier,
  config: ClubCapsConfig = DEFAULT_CLUB_CAPS,
): ClubLeagueCaps {
  return config[leagueId];
}

export function getMetricCaps(input: {
  leagueId: LeagueTier;
  metric: ClubEvolutionMetric;
  movement?: LeagueMovement;
  config?: ClubCapsConfig;
}): ClubMetricCaps {
  const leagueCaps = getLeagueClubCaps(input.leagueId, input.config);
  const baseCaps = leagueCaps.metrics[input.metric];
  const promotedMax = input.movement === "promoted" ? leagueCaps.promotedMax?.[input.metric] : undefined;

  return {
    ...baseCaps,
    max: promotedMax === undefined ? baseCaps.max : Math.min(baseCaps.max, promotedMax),
  };
}

export function applyClubMetricCaps(input: {
  leagueId: LeagueTier;
  metric: ClubEvolutionMetric;
  oldValue: number;
  requestedDelta: number;
  movement?: LeagueMovement;
  config?: ClubCapsConfig;
}): CappedMetricChange {
  const caps = getMetricCaps(input);
  const roundedDelta = Math.round(input.requestedDelta);
  const deltaLimited = clamp(roundedDelta, -caps.maxDecrease, caps.maxIncrease);
  const newValue = Math.round(clamp(input.oldValue + deltaLimited, caps.min, caps.max));
  const appliedDelta = newValue - input.oldValue;

  return {
    metric: input.metric,
    requestedDelta: roundedDelta,
    appliedDelta,
    oldValue: input.oldValue,
    newValue,
    min: caps.min,
    max: caps.max,
    maxIncrease: caps.maxIncrease,
    maxDecrease: caps.maxDecrease,
    wasCapped: appliedDelta !== roundedDelta,
  };
}
