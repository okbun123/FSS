import { describe, expect, it } from "vitest";
import {
  FICTIONAL_LEAGUES,
  K1_CLUBS,
  K1_LEAGUE_ID,
  K2_CLUBS,
  K2_LEAGUE_ID,
} from "../src/data/fictionalLeagues";
import {
  DEFAULT_CLUB_CAPS,
  PROMOTED_LOWER_MID_K1_CAPS,
} from "../src/domain/clubCaps";
import { evolveClubForSeason } from "../src/domain/clubEvolution";
import type {
  Club,
  ClubEvolutionMetric,
  ClubEvolutionResult,
  League,
  LeagueTableRow,
  LeagueTier,
} from "../src/domain/types";

function cloneClub(club: Club, overrides: Partial<Club> = {}): Club {
  const squadStrength = overrides.squadStrength ?? club.squadStrength;

  return {
    ...club,
    ...overrides,
    strength: squadStrength,
    squadLevel: squadStrength,
    squadSummary: {
      ...club.squadSummary,
      ...(overrides.squadSummary ?? {}),
      averageOvr: squadStrength,
    },
    seasonRecords: [...(overrides.seasonRecords ?? club.seasonRecords)],
  };
}

function leagueWith(leagueId: LeagueTier, clubs: readonly Club[]): League {
  return {
    ...FICTIONAL_LEAGUES[leagueId],
    clubs: [...clubs],
  };
}

function tableRows(clubs: readonly Club[]): LeagueTableRow[] {
  return clubs.map((club, index) => ({
    clubId: club.id,
    clubName: club.name,
    played: 30,
    wins: Math.max(0, 24 - index),
    draws: 3,
    losses: index,
    goalsFor: Math.max(20, 70 - index * 2),
    goalsAgainst: 25 + index,
    goalDifference: 45 - index * 3,
    points: Math.max(12, 75 - index * 3),
    position: index + 1,
  }));
}

function applyResult(club: Club, result: ClubEvolutionResult): Club {
  return cloneClub(club, {
    reputation: result.newValues.reputation,
    budgetLevel: result.newValues.budgetLevel,
    youthOpportunity: result.newValues.youthOpportunity,
    squadStrength: result.newValues.squadStrength,
  });
}

describe("club seasonal evolution", () => {
  it("keeps a K2 champion below the promoted lower-mid K1 reputation cap after one season", () => {
    const champion = cloneClub(K2_CLUBS[0]);
    const league = leagueWith(K2_LEAGUE_ID, [
      champion,
      ...K2_CLUBS.slice(1).map((club) => cloneClub(club)),
    ]);
    const result = evolveClubForSeason({
      club: champion,
      league,
      table: tableRows(league.clubs),
      seasonNumber: 1,
      movement: "promoted",
      predictedFinish: 1,
    });

    expect(result.newValues.reputation).toBeLessThanOrEqual(PROMOTED_LOWER_MID_K1_CAPS.reputation);
    expect(result.newValues.reputation).toBeLessThan(75);
    expect(result.newValues.reputation - result.oldValues.reputation).toBeLessThanOrEqual(
      DEFAULT_CLUB_CAPS[K2_LEAGUE_ID].metrics.reputation.maxIncrease,
    );
  });

  it("gives a promoted club a controlled increase", () => {
    const promoted = cloneClub(K2_CLUBS[1], {
      reputation: 61,
      budgetLevel: 50,
      squadStrength: 59,
    });
    const league = leagueWith(K2_LEAGUE_ID, [
      promoted,
      ...K2_CLUBS.filter((club) => club.id !== promoted.id).map((club) => cloneClub(club)),
    ]);
    const result = evolveClubForSeason({
      club: promoted,
      league,
      table: tableRows(league.clubs),
      seasonNumber: 1,
      movement: "promoted",
      predictedFinish: 3,
    });

    expect(result.newValues.reputation).toBeGreaterThan(result.oldValues.reputation);
    expect(result.newValues.reputation - result.oldValues.reputation).toBeLessThanOrEqual(3);
    expect(result.newValues.squadStrength - result.oldValues.squadStrength).toBeLessThanOrEqual(3);
    expect(result.newValues.budgetLevel - result.oldValues.budgetLevel).toBeLessThanOrEqual(2);
  });

  it("gives a relegated club a controlled decrease", () => {
    const relegated = cloneClub(K1_CLUBS.at(-1)!, {
      reputation: 66,
      budgetLevel: 53,
      squadStrength: 65,
    });
    const others = K1_CLUBS
      .filter((club) => club.id !== relegated.id)
      .map((club) => cloneClub(club));
    const league = leagueWith(K1_LEAGUE_ID, [...others, relegated]);
    const result = evolveClubForSeason({
      club: relegated,
      league,
      table: tableRows(league.clubs),
      seasonNumber: 1,
      movement: "relegated",
      predictedFinish: 11,
    });

    expect(result.newValues.reputation).toBeLessThan(result.oldValues.reputation);
    expect(result.newValues.reputation - result.oldValues.reputation).toBeGreaterThanOrEqual(-6);
    expect(result.newValues.squadStrength - result.oldValues.squadStrength).toBeGreaterThanOrEqual(-6);
    expect(result.newValues.budgetLevel - result.oldValues.budgetLevel).toBeGreaterThanOrEqual(-5);
  });

  it("lets a K1 champion improve while staying inside the league cap", () => {
    const champion = cloneClub(K1_CLUBS[0]);
    const league = leagueWith(K1_LEAGUE_ID, [
      champion,
      ...K1_CLUBS.slice(1).map((club) => cloneClub(club)),
    ]);
    const result = evolveClubForSeason({
      club: champion,
      league,
      table: tableRows(league.clubs),
      seasonNumber: 1,
      movement: "stayed",
      predictedFinish: 1,
    });

    expect(result.newValues.reputation).toBeGreaterThan(result.oldValues.reputation);
    expect(result.newValues.reputation).toBeLessThanOrEqual(DEFAULT_CLUB_CAPS[K1_LEAGUE_ID].metrics.reputation.max);
    expect(result.newValues.reputation - result.oldValues.reputation).toBeLessThanOrEqual(5);
  });

  it("keeps repeated updates within configured league min/max caps", () => {
    let k1Champion = cloneClub(K1_CLUBS[0], {
      reputation: 94,
      budgetLevel: 94,
      squadStrength: 89,
      youthOpportunity: 91,
    });

    for (let seasonNumber = 1; seasonNumber <= 20; seasonNumber += 1) {
      const league = leagueWith(K1_LEAGUE_ID, [
        k1Champion,
        ...K1_CLUBS.slice(1).map((club) => cloneClub(club)),
      ]);
      const result = evolveClubForSeason({
        club: k1Champion,
        league,
        table: tableRows(league.clubs),
        seasonNumber,
        movement: "stayed",
        predictedFinish: 1,
      });

      k1Champion = applyResult(k1Champion, result);

      for (const [metric, caps] of Object.entries(DEFAULT_CLUB_CAPS[K1_LEAGUE_ID].metrics)) {
        const value = k1Champion[metric as ClubEvolutionMetric];

        expect(value).toBeGreaterThanOrEqual(caps.min);
        expect(value).toBeLessThanOrEqual(caps.max);
      }
    }

    let k2Bottom = cloneClub(K2_CLUBS.at(-1)!, {
      reputation: 31,
      budgetLevel: 21,
      squadStrength: 39,
      youthOpportunity: 46,
    });

    for (let seasonNumber = 1; seasonNumber <= 20; seasonNumber += 1) {
      const others = K2_CLUBS
        .filter((club) => club.id !== k2Bottom.id)
        .map((club) => cloneClub(club));
      const league = leagueWith(K2_LEAGUE_ID, [...others, k2Bottom]);
      const result = evolveClubForSeason({
        club: k2Bottom,
        league,
        table: tableRows(league.clubs),
        seasonNumber,
        movement: "stayed",
        predictedFinish: 1,
      });

      k2Bottom = applyResult(k2Bottom, result);

      for (const [metric, caps] of Object.entries(DEFAULT_CLUB_CAPS[K2_LEAGUE_ID].metrics)) {
        const value = k2Bottom[metric as ClubEvolutionMetric];

        expect(value).toBeGreaterThanOrEqual(caps.min);
        expect(value).toBeLessThanOrEqual(caps.max);
      }
    }
  });
});
