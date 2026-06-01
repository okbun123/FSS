import { NON_PLAYABLE_D5_CLUBS } from "../data/nonPlayableClubs";
import { getLeagueRuleSetsForSeason, getNonPlayablePoolReplacementRule } from "./leagueRuleSet";
import { starsToInternalValue } from "./clubPublicInfo";
import type { Club, K4K5Mode, League, LeagueTier, NonPlayableClub, PromotionRelegationStatus } from "./types";
import { K4_LEAGUE_ID, LEAGUE_IDS } from "./leagueIds";

export interface SeasonRolloverInput {
  leagues: Record<LeagueTier, League>;
  clubs: Record<string, Club>;
  promotionRelegation?: PromotionRelegationStatus;
  nextSeasonStartYear: number;
  archivedNonPlayableClubs?: readonly NonPlayableClub[];
  k4K5Mode?: K4K5Mode;
  /** @deprecated Use k4K5Mode. */
  leagueMode?: "realistic" | "gameplay";
}

export interface SeasonRolloverResult {
  leagues: Record<LeagueTier, League>;
  clubs: Record<string, Club>;
  archivedNonPlayableClubs: NonPlayableClub[];
  relegatedOutClubIds: string[];
  promotedPoolClubIds: string[];
}

function getClubOrder(leagues: Record<LeagueTier, League>): Map<string, number> {
  return new Map(
    LEAGUE_IDS.flatMap((leagueId) => leagues[leagueId].clubs).map((club, index) => [
      club.id,
      index,
    ]),
  );
}

function sortClubsForLeague(clubs: readonly Club[], order: Map<string, number>): Club[] {
  return [...clubs].sort(
    (left, right) =>
      (order.get(left.id) ?? 9999) - (order.get(right.id) ?? 9999) ||
      left.name.localeCompare(right.name, "ko"),
  );
}

function withLeague(club: Club, leagueId: LeagueTier): Club {
  return {
    ...club,
    leagueId,
    tier: leagueId,
  };
}

function getAdjacentLeagueId(
  leagues: Record<LeagueTier, League>,
  leagueId: LeagueTier,
  direction: "up" | "down",
): LeagueTier | undefined {
  const level = leagues[leagueId].level + (direction === "up" ? -1 : 1);

  return LEAGUE_IDS.find((candidate) => leagues[candidate].level === level);
}

function selectPoolClubs(input: {
  count: number;
  usedClubIds: ReadonlySet<string>;
  archived: readonly NonPlayableClub[];
}): NonPlayableClub[] {
  if (input.count <= 0) {
    return [];
  }

  const archivedById = new Map(input.archived.map((club) => [club.id, club]));
  return [...NON_PLAYABLE_D5_CLUBS, ...input.archived]
    .filter((club, index, clubs) => clubs.findIndex((candidate) => candidate.id === club.id) === index)
    .filter((club) => club.licenseEligible)
    .filter((club) => !input.usedClubIds.has(club.id))
    .sort(
      (left, right) =>
        right.promotionWeight - left.promotionWeight ||
        Number(archivedById.has(right.id)) - Number(archivedById.has(left.id)) ||
        left.name.localeCompare(right.name, "ko"),
    )
    .slice(0, input.count);
}

function poolClubToPlayableClub(poolClub: NonPlayableClub, leagueId: LeagueTier): Club {
  const reputation = starsToInternalValue(poolClub.reputationStars);
  const squadStrength = starsToInternalValue(poolClub.squadStrengthStars);
  const budgetLevel = starsToInternalValue(poolClub.budgetStars);
  const youthOpportunity = starsToInternalValue(poolClub.youthOpportunityStars);
  const training = starsToInternalValue(poolClub.trainingFacilityStars);

  return {
    id: poolClub.id.replace(/^d5-/, "k4-"),
    name: poolClub.name,
    shortName: poolClub.name.split(" ")[1] ?? poolClub.name,
    city: poolClub.region,
    leagueId,
    reputation,
    trainingFacilities: {
      technicalTraining: training,
      physicalTraining: training,
      tacticalTraining: training,
      mentalTraining: training,
      youthDevelopment: youthOpportunity,
      medicalSupport: training,
    },
    squadStrength,
    budgetLevel,
    playStyle: "승격 직후의 균형형 축구",
    youthOpportunity,
    transferPolicy: "지역 선수와 자유계약 중심",
    tier: leagueId,
    strength: squadStrength,
    squadLevel: squadStrength,
    primaryColor: "신규 지역색",
    secondaryColor: "보조색 없음",
    squadSummary: {
      averageOvr: squadStrength,
      averageAge: 23,
      depth: Math.max(28, squadStrength),
      style: "승격 직후의 균형형 축구",
    },
    licenseEligible: poolClub.licenseEligible,
    promotionIntent: true,
    seasonRecords: [],
  };
}

export function applySeasonRollover(input: SeasonRolloverInput): SeasonRolloverResult {
  const promotedClubIds = new Set(input.promotionRelegation?.promotedClubIds ?? []);
  const relegatedClubIds = new Set(input.promotionRelegation?.relegatedClubIds ?? []);
  const k4ReplacementRule = getNonPlayablePoolReplacementRule(
    input.leagues[K4_LEAGUE_ID].ruleSet,
    input.k4K5Mode,
    input.leagueMode,
  );
  const k4K5ReplacementEnabled = Boolean(k4ReplacementRule);
  const nextRuleSets = getLeagueRuleSetsForSeason(input.nextSeasonStartYear);
  const order = getClubOrder(input.leagues);
  const sourceClubs = Object.keys(input.clubs).length > 0
    ? Object.values(input.clubs)
    : LEAGUE_IDS.flatMap((leagueId) => input.leagues[leagueId].clubs);
  const archived: NonPlayableClub[] = (input.archivedNonPlayableClubs ?? []).map((club) => ({
    ...club,
    lastPoolResult: club.lastPoolResult ?? "이전 시즌 5부 풀",
  }));
  const relegatedOutClubIds: string[] = [];
  const clubs: Record<string, Club> = {};

  for (const club of sourceClubs) {
    const promotedLeagueId = promotedClubIds.has(club.id)
      ? getAdjacentLeagueId(input.leagues, club.leagueId, "up")
      : undefined;
    const relegatedLeagueId = relegatedClubIds.has(club.id)
      ? getAdjacentLeagueId(input.leagues, club.leagueId, "down")
      : undefined;

    if (relegatedClubIds.has(club.id) && !relegatedLeagueId && club.leagueId === K4_LEAGUE_ID && !k4K5ReplacementEnabled) {
      clubs[club.id] = withLeague(club, club.leagueId);
      continue;
    }

    if (relegatedClubIds.has(club.id) && !relegatedLeagueId) {
      relegatedOutClubIds.push(club.id);
      archived.push({
        id: club.id,
        name: club.name,
        region: club.city,
        reputationStars: Math.max(1, Math.min(5, Math.round(club.reputation / 20))),
        squadStrengthStars: Math.max(1, Math.min(5, Math.round(club.squadStrength / 20))),
        budgetStars: Math.max(1, Math.min(5, Math.round(club.budgetLevel / 20))),
        youthOpportunityStars: Math.max(1, Math.min(5, Math.round(club.youthOpportunity / 20))),
        trainingFacilityStars: 2,
        licenseEligible: club.licenseEligible ?? false,
        promotionWeight: Math.max(4, Math.round(club.reputation / 8)),
        lastPoolResult: `${input.nextSeasonStartYear - 1}시즌 4부 강등`,
      });
      continue;
    }

    const nextLeagueId = promotedLeagueId ?? relegatedLeagueId ?? club.leagueId;
    clubs[club.id] = withLeague(club, nextLeagueId);
  }

  const k4TargetSize = nextRuleSets[K4_LEAGUE_ID].teamCountTargetByLeague[K4_LEAGUE_ID];
  const k4PlayableClubCount = Object.values(clubs).filter((club) => club.leagueId === K4_LEAGUE_ID).length;
  const poolPromotionCount = k4TargetSize
    ? Math.max(relegatedOutClubIds.length, k4TargetSize - k4PlayableClubCount)
    : relegatedOutClubIds.length;
  const promotedPoolClubs = !k4K5ReplacementEnabled
    ? []
    : selectPoolClubs({
        count: poolPromotionCount,
        usedClubIds: new Set(Object.keys(clubs)),
        archived,
      });
  for (const poolClub of promotedPoolClubs) {
    const playableClub = poolClubToPlayableClub(poolClub, K4_LEAGUE_ID);
    clubs[playableClub.id] = playableClub;
  }
  const promotedPoolIds = new Set(promotedPoolClubs.map((club) => club.id));
  const archivedNonPlayableClubs = archived.filter((club) => !promotedPoolIds.has(club.id));
  const leagues = Object.fromEntries(
    LEAGUE_IDS.map((leagueId) => [
      leagueId,
      {
        ...input.leagues[leagueId],
        ruleSet: nextRuleSets[leagueId],
        clubs: sortClubsForLeague(
          Object.values(clubs).filter((club) => club.leagueId === leagueId),
          order,
        ),
      },
    ]),
  ) as Record<LeagueTier, League>;

  return {
    clubs,
    leagues,
    archivedNonPlayableClubs,
    relegatedOutClubIds,
    promotedPoolClubIds: promotedPoolClubs.map((club) => poolClubToPlayableClub(club, K4_LEAGUE_ID).id),
  };
}
