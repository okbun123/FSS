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
import type {
  Club,
  Fixture,
  K4K5Mode,
  League,
  LeagueTableRow,
  LeagueTier,
  PromotionRelegationStatus,
} from "../domain/types";

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

function tablesForLeagues(leagues: Record<LeagueTier, League> = FICTIONAL_LEAGUES): Record<LeagueTier, LeagueTableRow[]> {
  return {
    [K1_LEAGUE_ID]: tableRows(leagues[K1_LEAGUE_ID].clubs),
    [K2_LEAGUE_ID]: tableRows(leagues[K2_LEAGUE_ID].clubs),
    [K3_LEAGUE_ID]: tableRows(leagues[K3_LEAGUE_ID].clubs),
    [K4_LEAGUE_ID]: tableRows(leagues[K4_LEAGUE_ID].clubs),
  };
}

function clubsById(leagues: Record<LeagueTier, League> = FICTIONAL_LEAGUES): Record<string, Club> {
  return Object.fromEntries(
    Object.values(leagues).flatMap((league) => league.clubs).map((club) => [club.id, club]),
  );
}

function cloneLeaguesWithClubPatch(
  leagueId: LeagueTier,
  clubId: string,
  patch: Partial<Club>,
): Record<LeagueTier, League> {
  return Object.fromEntries(
    Object.values(FICTIONAL_LEAGUES).map((league) => [
      league.id,
      {
        ...league,
        clubs: league.clubs.map((club) =>
          league.id === leagueId && club.id === clubId
            ? { ...club, ...patch }
            : { ...club },
        ),
      },
    ]),
  ) as Record<LeagueTier, League>;
}

function resolvedUpperStatus(): PromotionRelegationStatus {
  return {
    seasonNumber: 1,
    seasonStartYear: 2027,
    stage: "resolved",
    isResolved: true,
    directPromotionClubIds: [],
    directRelegationClubIds: [],
    promotedClubIds: [],
    relegatedClubIds: [],
    playoffFixtureIds: [],
    playoffResults: [],
    promotionRelegationTies: [],
    note: "upper resolved",
  };
}

function progressLowerPyramid(input: {
  leagues?: Record<LeagueTier, League>;
  tables?: Record<LeagueTier, LeagueTableRow[]>;
  k4K5Mode?: K4K5Mode;
} = {}) {
  const leagues = input.leagues ?? FICTIONAL_LEAGUES;

  return progressPromotionRelegation({
    seasonNumber: 1,
    seasonStartYear: 2027,
    leagues,
    tables: input.tables ?? tablesForLeagues(leagues),
    fixtures: [regularFixture()],
    currentStatus: resolvedUpperStatus(),
    k4K5Mode: input.k4K5Mode,
  });
}

function progressFor2026(fixtures: readonly Fixture[] = [regularFixture()]) {
  return progressPromotionRelegation({
    seasonNumber: 1,
    seasonStartYear: 2026,
    leagues: FICTIONAL_LEAGUES,
    tables: tablesForLeagues(),
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

  it("creates a single-leg K2-K3 playoff when the K3 champion is license eligible", () => {
    const k3Champion = FICTIONAL_LEAGUES[K3_LEAGUE_ID].clubs[0];
    const k2Bottom = FICTIONAL_LEAGUES[K2_LEAGUE_ID].clubs.at(-1)!;
    const result = progressLowerPyramid({ k4K5Mode: "realistic_suspended" });
    const tieRecord = result.status.promotionRelegationTies?.find(
      (tie) => tie.ruleId === "k3-champion-vs-k2-bottom",
    );
    const fixture = result.fixtures.find((candidate) => candidate.id === tieRecord?.fixtureIds[0]);

    expect(tieRecord).toBeDefined();
    expect(fixture?.homeClubId).toBe(k2Bottom.id);
    expect(fixture?.awayClubId).toBe(k3Champion.id);
    expect(fixture?.date).toBe("2026-12-05T11:00:00.000Z");
    expect(fixture?.playoff?.tieFormat).toBe("singleLeg");
    expect(fixture?.playoff?.drawAdvantageClubId).toBeUndefined();
  });

  it("does not promote an unlicensed K3 champion or open the K2-K3 playoff", () => {
    const k3Champion = FICTIONAL_LEAGUES[K3_LEAGUE_ID].clubs[0];
    const leagues = cloneLeaguesWithClubPatch(K3_LEAGUE_ID, k3Champion.id, {
      licenseEligible: false,
    });
    const result = progressLowerPyramid({ leagues, k4K5Mode: "realistic_suspended" });

    expect(result.status.promotedClubIds).not.toContain(k3Champion.id);
    expect(
      result.status.promotionRelegationTies?.some((tie) => tie.ruleId === "k3-champion-vs-k2-bottom"),
    ).toBe(false);
  });

  it("does not relegate the K2 bottom club when there is no licensed K3 challenger", () => {
    const k3Champion = FICTIONAL_LEAGUES[K3_LEAGUE_ID].clubs[0];
    const k2Bottom = FICTIONAL_LEAGUES[K2_LEAGUE_ID].clubs.at(-1)!;
    const leagues = cloneLeaguesWithClubPatch(K3_LEAGUE_ID, k3Champion.id, {
      licenseEligible: false,
    });
    const result = progressLowerPyramid({ leagues, k4K5Mode: "realistic_suspended" });

    expect(result.status.relegatedClubIds).not.toContain(k2Bottom.id);
  });

  it("uses K4 promotion intent when deciding direct promotion eligibility", () => {
    const k4Champion = FICTIONAL_LEAGUES[K4_LEAGUE_ID].clubs[0];
    const withoutIntent = cloneLeaguesWithClubPatch(K4_LEAGUE_ID, k4Champion.id, {
      licenseEligible: true,
      promotionIntent: false,
    });
    const withIntent = cloneLeaguesWithClubPatch(K4_LEAGUE_ID, k4Champion.id, {
      licenseEligible: true,
      promotionIntent: true,
    });

    expect(progressLowerPyramid({ leagues: withoutIntent }).status.promotedClubIds).not.toContain(k4Champion.id);
    expect(progressLowerPyramid({ leagues: withIntent }).status.promotedClubIds).toContain(k4Champion.id);
  });

  it("handles Division 4 relegation differently in realistic and gameplay modes", () => {
    const k4Bottom = FICTIONAL_LEAGUES[K4_LEAGUE_ID].clubs.at(-1)!;
    const realistic = progressLowerPyramid({ k4K5Mode: "realistic_suspended" });
    const gameplay = progressLowerPyramid({ k4K5Mode: "gameplay_relegation_enabled" });

    expect(realistic.status.relegatedClubIds).not.toContain(k4Bottom.id);
    expect(gameplay.status.relegatedClubIds).toContain(k4Bottom.id);
  });

  it("records penalty shootout winners for tied single-leg promotion/relegation playoffs", () => {
    const result = progressLowerPyramid({ k4K5Mode: "realistic_suspended" });
    const fixture = result.fixtures.find((candidate) =>
      candidate.playoff?.stage === "promotionRelegationPlayoff" &&
      candidate.playoff.tieFormat === "singleLeg",
    )!;
    const playedFixture: Fixture = {
      ...fixture,
      status: "played",
      result: {
        homeGoals: 1,
        awayGoals: 1,
        winnerClubId: fixture.awayClubId,
        decidedBy: "penalties",
        homePenaltyGoals: 3,
        awayPenaltyGoals: 4,
      },
    };

    expect(resolveSingleLegPlayoffFixture(playedFixture)?.winnerClubId).toBe(fixture.awayClubId);
    expect(resolveSingleLegPlayoffFixture(playedFixture)?.decidedBy).toBe("penalties");
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

  it("keeps lower playable divisions at valid target sizes after K4 promotion and pool replacement", () => {
    const lowerResult = progressLowerPyramid({ k4K5Mode: "gameplay_relegation_enabled" });
    const rolled = applySeasonRollover({
      leagues: FICTIONAL_LEAGUES,
      clubs: clubsById(),
      promotionRelegation: lowerResult.status,
      nextSeasonStartYear: 2028,
      k4K5Mode: "gameplay_relegation_enabled",
    });

    expect(rolled.leagues[K3_LEAGUE_ID].clubs).toHaveLength(16);
    expect(rolled.leagues[K4_LEAGUE_ID].clubs).toHaveLength(18);
    expect(rolled.promotedPoolClubIds).toHaveLength(2);
    expect(new Set(Object.keys(rolled.clubs)).size).toBe(Object.keys(rolled.clubs).length);
  });
});
