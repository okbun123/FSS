import { NON_PLAYABLE_D5_CLUBS } from "../data/nonPlayableClubs";
import { getLeagueRuleSetsForSeason } from "./leagueRules";
import { starsToInternalValue } from "./clubPublicInfo";
import type { Club, League, LeagueTier, NonPlayableClub, PromotionRelegationStatus } from "./types";

const K1_LEAGUE_ID = "k1_fictional" satisfies LeagueTier;
const K2_LEAGUE_ID = "k2_fictional" satisfies LeagueTier;
const K3_LEAGUE_ID = "k3_fictional" satisfies LeagueTier;
const K4_LEAGUE_ID = "k4_fictional" satisfies LeagueTier;
const LEAGUE_IDS = [K1_LEAGUE_ID, K2_LEAGUE_ID, K3_LEAGUE_ID, K4_LEAGUE_ID] as const satisfies readonly LeagueTier[];

export interface SeasonRolloverInput {
  leagues: Record<LeagueTier, League>;
  clubs: Record<string, Club>;
  promotionRelegation?: PromotionRelegationStatus;
  nextSeasonStartYear: number;
  archivedNonPlayableClubs?: readonly NonPlayableClub[];
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
  const nextRuleSets = getLeagueRuleSetsForSeason(input.nextSeasonStartYear);
  const order = getClubOrder(input.leagues);
  const sourceClubs = Object.keys(input.clubs).length > 0
    ? Object.values(input.clubs)
    : LEAGUE_IDS.flatMap((leagueId) => input.leagues[leagueId].clubs);
  const archived: NonPlayableClub[] = [...(input.archivedNonPlayableClubs ?? [])];
  const relegatedOutClubIds: string[] = [];
  const clubs: Record<string, Club> = {};

  for (const club of sourceClubs) {
    const promotedLeagueId = promotedClubIds.has(club.id)
      ? getAdjacentLeagueId(input.leagues, club.leagueId, "up")
      : undefined;
    const relegatedLeagueId = relegatedClubIds.has(club.id)
      ? getAdjacentLeagueId(input.leagues, club.leagueId, "down")
      : undefined;

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
      });
      continue;
    }

    const nextLeagueId = promotedLeagueId ?? relegatedLeagueId ?? club.leagueId;
    clubs[club.id] = withLeague(club, nextLeagueId);
  }

  const promotedPoolClubs = input.leagueMode === "realistic"
    ? []
    : selectPoolClubs({
        count: relegatedOutClubIds.length,
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
