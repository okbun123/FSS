import { getLeagueRuleSetsForSeason } from "./leagueRules";
import type { Club, League, LeagueTier, PromotionRelegationStatus } from "./types";

const K1_LEAGUE_ID = "k1_fictional" satisfies LeagueTier;
const K2_LEAGUE_ID = "k2_fictional" satisfies LeagueTier;
const LEAGUE_IDS = [K1_LEAGUE_ID, K2_LEAGUE_ID] as const satisfies readonly LeagueTier[];

export interface SeasonRolloverInput {
  leagues: Record<LeagueTier, League>;
  clubs: Record<string, Club>;
  promotionRelegation?: PromotionRelegationStatus;
  nextSeasonStartYear: number;
}

export interface SeasonRolloverResult {
  leagues: Record<LeagueTier, League>;
  clubs: Record<string, Club>;
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

export function applySeasonRollover(input: SeasonRolloverInput): SeasonRolloverResult {
  const promotedClubIds = new Set(input.promotionRelegation?.promotedClubIds ?? []);
  const relegatedClubIds = new Set(input.promotionRelegation?.relegatedClubIds ?? []);
  const nextRuleSets = getLeagueRuleSetsForSeason(input.nextSeasonStartYear);
  const order = getClubOrder(input.leagues);
  const sourceClubs = Object.keys(input.clubs).length > 0
    ? Object.values(input.clubs)
    : LEAGUE_IDS.flatMap((leagueId) => input.leagues[leagueId].clubs);
  const clubs: Record<string, Club> = Object.fromEntries(
    sourceClubs.map((club) => {
      const nextLeagueId = promotedClubIds.has(club.id)
        ? K1_LEAGUE_ID
        : relegatedClubIds.has(club.id)
          ? K2_LEAGUE_ID
          : club.leagueId;
      const updatedClub = withLeague(club, nextLeagueId);

      return [club.id, updatedClub];
    }),
  );
  const k1Clubs = sortClubsForLeague(
    Object.values(clubs).filter((club) => club.leagueId === K1_LEAGUE_ID),
    order,
  );
  const k2Clubs = sortClubsForLeague(
    Object.values(clubs).filter((club) => club.leagueId === K2_LEAGUE_ID),
    order,
  );

  return {
    clubs,
    leagues: {
      [K1_LEAGUE_ID]: {
        ...input.leagues[K1_LEAGUE_ID],
        ruleSet: nextRuleSets[K1_LEAGUE_ID],
        clubs: k1Clubs,
      },
      [K2_LEAGUE_ID]: {
        ...input.leagues[K2_LEAGUE_ID],
        ruleSet: nextRuleSets[K2_LEAGUE_ID],
        clubs: k2Clubs,
      },
    },
  };
}
