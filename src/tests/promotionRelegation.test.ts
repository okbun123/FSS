import { describe, expect, it } from "vitest";
import {
  FICTIONAL_LEAGUES,
  K1_LEAGUE_ID,
  K2_LEAGUE_ID,
  K3_LEAGUE_ID,
  K4_LEAGUE_ID,
} from "../data/fictionalLeagues";
import { progressPromotionRelegation } from "../domain/promotionRelegation";
import {
  createPromotionRelegationTie,
  resolveSingleLegPlayoffFixture,
  resolveTwoLeggedTie,
} from "../domain/playoffs";
import { applySeasonRollover } from "../domain/seasonRollover";
import type { Fixture, LeagueTableRow, PromotionRelegationStatus } from "../domain/types";

function tableRows(clubs: readonly { id: string; name: string }[]): LeagueTableRow[] {
  return clubs.map((club, index) => ({
    clubId: club.id,
    clubName: club.name,
    played: 10,
    wins: Math.max(0, 10 - index),
    draws: 0,
    losses: index,
    goalsFor: Math.max(0, 30 - index),
    goalsAgainst: index,
    goalDifference: 30 - index * 2,
    points: Math.max(0, 30 - index * 3),
    position: index + 1,
  }));
}

function regularFixture(seasonNumber = 1): Fixture {
  const [home, away] = FICTIONAL_LEAGUES[K1_LEAGUE_ID].clubs;

  return {
    id: `regular-${seasonNumber}`,
    leagueId: K1_LEAGUE_ID,
    competitionId: FICTIONAL_LEAGUES[K1_LEAGUE_ID].competitionId,
    seasonNumber,
    round: 39,
    month: 11,
    date: "2026-11-28T11:00:00.000Z",
    weekNumber: 39,
    homeClubId: home.id,
    awayClubId: away.id,
    status: "played",
    result: { homeGoals: 1, awayGoals: 0 },
  };
}

function progressFor2026(fixtures: readonly Fixture[] = [regularFixture()]) {
  return progressPromotionRelegation({
    seasonNumber: 1,
    seasonStartYear: 2026,
    leagues: FICTIONAL_LEAGUES,
    tables: {
      [K1_LEAGUE_ID]: tableRows(FICTIONAL_LEAGUES[K1_LEAGUE_ID].clubs),
      [K2_LEAGUE_ID]: tableRows(FICTIONAL_LEAGUES[K2_LEAGUE_ID].clubs),
      [K3_LEAGUE_ID]: tableRows(FICTIONAL_LEAGUES[K3_LEAGUE_ID].clubs),
      [K4_LEAGUE_ID]: tableRows(FICTIONAL_LEAGUES[K4_LEAGUE_ID].clubs),
    },
    fixtures,
  });
}

describe("promotion/relegation rules", () => {
  it("uses two direct K2 promotion slots in the 2026 transition rule", () => {
    const result = progressFor2026();
    const k2Clubs = FICTIONAL_LEAGUES[K2_LEAGUE_ID].clubs;

    expect(result.status.directPromotionClubIds).toEqual([k2Clubs[0].id, k2Clubs[1].id]);
  });

  it("places K2 3rd to 6th into the 2026 promotion playoff", () => {
    const result = progressFor2026();
    const k2Clubs = FICTIONAL_LEAGUES[K2_LEAGUE_ID].clubs;

    expect(result.status.promotionPlayoffClubIds).toEqual(
      k2Clubs.slice(2, 6).map((club) => club.id),
    );
  });

  it("generates 3rd-vs-6th and 4th-vs-5th K2 semifinals", () => {
    const result = progressFor2026();
    const k2Clubs = FICTIONAL_LEAGUES[K2_LEAGUE_ID].clubs;
    const semifinals = result.fixtures.filter(
      (fixture) => fixture.playoff?.stage === "promotionPlayoffSemifinals",
    );

    expect(semifinals).toHaveLength(2);
    expect([semifinals[0].homeClubId, semifinals[0].awayClubId]).toEqual([k2Clubs[2].id, k2Clubs[5].id]);
    expect([semifinals[1].homeClubId, semifinals[1].awayClubId]).toEqual([k2Clubs[3].id, k2Clubs[4].id]);
  });

  it("advances the higher seed on a drawn K2 playoff match", () => {
    const result = progressFor2026();
    const semifinal = {
      ...result.fixtures.find((fixture) => fixture.playoff?.stage === "promotionPlayoffSemifinals")!,
      status: "played" as const,
      result: { homeGoals: 1, awayGoals: 1 },
    };

    expect(resolveSingleLegPlayoffFixture(semifinal)?.winnerClubId).toBe(semifinal.homeClubId);
    expect(resolveSingleLegPlayoffFixture(semifinal)?.decidedBy).toBe("higherSeed");
  });

  it("resolves a two-legged promotion/relegation playoff by aggregate score", () => {
    const [k1Club] = FICTIONAL_LEAGUES[K1_LEAGUE_ID].clubs.slice(-1);
    const [k2Club] = FICTIONAL_LEAGUES[K2_LEAGUE_ID].clubs;
    const tie = createPromotionRelegationTie({
      seasonNumber: 1,
      leagueId: K1_LEAGUE_ID,
      k1ClubId: k1Club.id,
      k2ClubId: k2Club.id,
      fixtures: [regularFixture()],
    });
    const fixtures = [
      { ...tie.fixtures[0], status: "played" as const, result: { homeGoals: 2, awayGoals: 0 } },
      { ...tie.fixtures[1], status: "played" as const, result: { homeGoals: 1, awayGoals: 1 } },
    ];

    expect(resolveTwoLeggedTie(fixtures)?.winnerClubId).toBe(k2Club.id);
    expect(resolveTwoLeggedTie(fixtures)?.decidedBy).toBe("normalTime");
  });

  it("uses extra time when a two-legged tie is level on aggregate", () => {
    const [k1Club] = FICTIONAL_LEAGUES[K1_LEAGUE_ID].clubs.slice(-1);
    const [k2Club] = FICTIONAL_LEAGUES[K2_LEAGUE_ID].clubs;
    const tie = createPromotionRelegationTie({
      seasonNumber: 1,
      leagueId: K1_LEAGUE_ID,
      k1ClubId: k1Club.id,
      k2ClubId: k2Club.id,
      fixtures: [regularFixture()],
    });
    const fixtures = [
      { ...tie.fixtures[0], status: "played" as const, result: { homeGoals: 1, awayGoals: 0 } },
      {
        ...tie.fixtures[1],
        status: "played" as const,
        result: { homeGoals: 1, awayGoals: 0, winnerClubId: k1Club.id, decidedBy: "extraTime" as const },
      },
    ];
    const resolution = resolveTwoLeggedTie(fixtures);

    expect(resolution?.winnerClubId).toBe(k1Club.id);
    expect(resolution?.decidedBy).toBe("extraTime");
  });

  it("uses penalties when extra time does not break an aggregate tie", () => {
    const [k1Club] = FICTIONAL_LEAGUES[K1_LEAGUE_ID].clubs.slice(-1);
    const [k2Club] = FICTIONAL_LEAGUES[K2_LEAGUE_ID].clubs;
    const tie = createPromotionRelegationTie({
      seasonNumber: 1,
      leagueId: K1_LEAGUE_ID,
      k1ClubId: k1Club.id,
      k2ClubId: k2Club.id,
      fixtures: [regularFixture()],
    });
    const fixtures = [
      { ...tie.fixtures[0], status: "played" as const, result: { homeGoals: 0, awayGoals: 0 } },
      {
        ...tie.fixtures[1],
        status: "played" as const,
        result: {
          homeGoals: 0,
          awayGoals: 0,
          winnerClubId: k2Club.id,
          decidedBy: "penalties" as const,
          homePenaltyGoals: 4,
          awayPenaltyGoals: 5,
        },
      },
    ];
    const resolution = resolveTwoLeggedTie(fixtures);

    expect(resolution?.winnerClubId).toBe(k2Club.id);
    expect(resolution?.decidedBy).toBe("penalties");
  });

  it("moves promoted and relegated clubs into next season membership", () => {
    const promotedClub = FICTIONAL_LEAGUES[K2_LEAGUE_ID].clubs[0];
    const relegatedClub = FICTIONAL_LEAGUES[K1_LEAGUE_ID].clubs.at(-1)!;
    const status: PromotionRelegationStatus = {
      isResolved: true,
      promotedClubIds: [promotedClub.id],
      relegatedClubIds: [relegatedClub.id],
      note: "test",
    };

    const rolled = applySeasonRollover({
      leagues: FICTIONAL_LEAGUES,
      clubs: Object.fromEntries(
        Object.values(FICTIONAL_LEAGUES).flatMap((league) => league.clubs).map((club) => [club.id, club]),
      ),
      promotionRelegation: status,
      nextSeasonStartYear: 2028,
    });

    expect(rolled.clubs[promotedClub.id].leagueId).toBe(K1_LEAGUE_ID);
    expect(rolled.clubs[relegatedClub.id].leagueId).toBe(K2_LEAGUE_ID);
    expect(rolled.leagues[K1_LEAGUE_ID].clubs.map((club) => club.id)).toContain(promotedClub.id);
    expect(rolled.leagues[K2_LEAGUE_ID].clubs.map((club) => club.id)).toContain(relegatedClub.id);
  });

  it("keeps K1 at 14 teams after the 2027 default rollover", () => {
    const promotedClub = FICTIONAL_LEAGUES[K2_LEAGUE_ID].clubs[0];
    const relegatedClub = FICTIONAL_LEAGUES[K1_LEAGUE_ID].clubs.at(-1)!;

    const rolled = applySeasonRollover({
      leagues: FICTIONAL_LEAGUES,
      clubs: Object.fromEntries(
        Object.values(FICTIONAL_LEAGUES).flatMap((league) => league.clubs).map((club) => [club.id, club]),
      ),
      promotionRelegation: {
        isResolved: true,
        promotedClubIds: [promotedClub.id],
        relegatedClubIds: [relegatedClub.id],
        note: "test",
      },
      nextSeasonStartYear: 2028,
    });

    expect(rolled.leagues[K1_LEAGUE_ID].clubs).toHaveLength(14);
    expect(rolled.leagues[K1_LEAGUE_ID].ruleSet.teamCountTargetByLeague[K1_LEAGUE_ID]).toBe(14);
  });
});
