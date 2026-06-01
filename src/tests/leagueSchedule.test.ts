import { describe, expect, it } from "vitest";
import {
  FICTIONAL_LEAGUES,
  K1_CLUBS,
  K1_LEAGUE_ID,
  K2_LEAGUE_ID,
  K3_LEAGUE_ID,
  K4_LEAGUE_ID,
  getAllClubs,
} from "../data/fictionalLeagues";
import { averageTrainingFacilities } from "../domain/clubPublicInfo";
import { createInitialDomesticCupFixtures, progressDomesticCupFixtures } from "../domain/domesticCup";
import type { Club, Fixture, LeagueTier } from "../domain/types";
import { generateLeagueFixtures } from "../game/leagueSchedule";

describe("generateLeagueFixtures", () => {
  it("defines a 14-club fictional Korean first division", () => {
    expect(FICTIONAL_LEAGUES[K1_LEAGUE_ID].id).toBe("div1");
    expect(FICTIONAL_LEAGUES[K1_LEAGUE_ID].name).toBe("코리아 프리미어 1");
    expect(K1_CLUBS).toHaveLength(14);
  });

  it("defines four playable divisions with Step 8 ids, names, and ranges", () => {
    const expected: Array<[LeagueTier, string, number, string]> = [
      [K1_LEAGUE_ID, "코리아 프리미어 1", 1, "K1-inspired"],
      [K2_LEAGUE_ID, "코리아 챌린지 2", 2, "K2-inspired"],
      [K3_LEAGUE_ID, "코리아 내셔널 3", 3, "K3-inspired"],
      [K4_LEAGUE_ID, "코리아 세미프로 4", 4, "K4-inspired"],
    ];

    expect(Object.keys(FICTIONAL_LEAGUES)).toEqual(["div1", "div2", "div3", "div4"]);

    for (const [leagueId, name, level, inspiration] of expected) {
      const league = FICTIONAL_LEAGUES[leagueId];

      expect(league.id).toBe(leagueId);
      expect(league.name).toBe(name);
      expect(league.level).toBe(level);
      expect(league.inspiration).toBe(inspiration);
      expect(league.clubs.length).toBeGreaterThan(0);
      expect(league.reputationRange.min).toBeLessThan(league.reputationRange.max);
      expect(league.squadStrengthRange.min).toBeLessThan(league.squadStrengthRange.max);
      expect(league.budgetRange.min).toBeLessThan(league.budgetRange.max);
      expect(league.trainingFacilityRange.min).toBeLessThan(league.trainingFacilityRange.max);
      for (const club of league.clubs) {
        expect(club.reputation).toBeGreaterThanOrEqual(league.reputationRange.min);
        expect(club.reputation).toBeLessThanOrEqual(league.reputationRange.max);
        expect(club.squadStrength).toBeGreaterThanOrEqual(league.squadStrengthRange.min);
        expect(club.squadStrength).toBeLessThanOrEqual(league.squadStrengthRange.max);
        expect(club.budgetLevel).toBeGreaterThanOrEqual(league.budgetRange.min);
        expect(club.budgetLevel).toBeLessThanOrEqual(league.budgetRange.max);
        expect(averageTrainingFacilities(club.trainingFacilities)).toBeGreaterThanOrEqual(league.trainingFacilityRange.min);
        expect(averageTrainingFacilities(club.trainingFacilities)).toBeLessThanOrEqual(league.trainingFacilityRange.max);
      }
    }
  });

  it("keeps lower divisions lower on average while allowing variance", () => {
    const average = (leagueId: LeagueTier, value: (club: Club) => number) => {
      const clubs = FICTIONAL_LEAGUES[leagueId].clubs;
      return clubs.reduce((sum, club) => sum + value(club), 0) / clubs.length;
    };
    const metrics = [
      (club: Club) => club.reputation,
      (club: Club) => club.budgetLevel,
      (club: Club) => club.squadStrength,
      (club: Club) => averageTrainingFacilities(club.trainingFacilities),
    ];

    for (const metric of metrics) {
      expect(average(K1_LEAGUE_ID, metric)).toBeGreaterThan(average(K2_LEAGUE_ID, metric));
      expect(average(K2_LEAGUE_ID, metric)).toBeGreaterThan(average(K3_LEAGUE_ID, metric));
      expect(average(K3_LEAGUE_ID, metric)).toBeGreaterThan(average(K4_LEAGUE_ID, metric));
    }

    expect(Math.max(...FICTIONAL_LEAGUES[K4_LEAGUE_ID].clubs.map((club) => club.reputation)))
      .toBeGreaterThan(Math.min(...FICTIONAL_LEAGUES[K3_LEAGUE_ID].clubs.map((club) => club.reputation)));
  });

  it("generates league fixtures for all four playable divisions", () => {
    for (const league of Object.values(FICTIONAL_LEAGUES)) {
      const fixtures = generateLeagueFixtures(league, { seasonNumber: 1 });
      const clubsInFixtures = new Set(fixtures.flatMap((fixture) => [fixture.homeClubId, fixture.awayClubId]));

      expect(fixtures.length).toBeGreaterThan(0);
      expect(clubsInFixtures.size).toBe(league.clubs.length);
      expect(fixtures.every((fixture) => fixture.leagueId === league.id)).toBe(true);
      expect(fixtures.every((fixture) => fixture.competitionId === league.competitionId)).toBe(true);
    }
  });

  it("includes teams from every playable division in the domestic cup", () => {
    let fixtures = createInitialDomesticCupFixtures({
      clubs: getAllClubs(),
      seasonNumber: 1,
      seasonYear: 2027,
    });
    const clubsById = Object.fromEntries(getAllClubs().map((club) => [club.id, club]));

    for (const round of [0, 1, 2]) {
      fixtures = progressDomesticCupFixtures({
        fixtures: fixtures.map((fixture): Fixture =>
          fixture.round === round
            ? {
                ...fixture,
                status: "played",
                result: {
                  homeGoals: 2,
                  awayGoals: 0,
                  winnerClubId: fixture.homeClubId,
                },
              }
            : fixture,
        ),
        clubsById,
        seasonNumber: 1,
        seasonYear: 2027,
      });
    }

    const entrantLeagueIds = new Set(
      fixtures
        .flatMap((fixture) => [fixture.homeClubId, fixture.awayClubId])
        .map((clubId) => clubsById[clubId]?.leagueId)
        .filter((leagueId): leagueId is LeagueTier => Boolean(leagueId)),
    );

    expect(entrantLeagueIds).toEqual(new Set([K1_LEAGUE_ID, K2_LEAGUE_ID, K3_LEAGUE_ID, K4_LEAGUE_ID]));
  });

  it("creates a K1 three-round-robin schedule with 39 matches per club", () => {
    const fixtures = generateLeagueFixtures(FICTIONAL_LEAGUES[K1_LEAGUE_ID], { seasonNumber: 1 });
    const counts = new Map<string, number>();
    const pairCounts = new Map<string, number>();

    for (const fixture of fixtures) {
      counts.set(fixture.homeClubId, (counts.get(fixture.homeClubId) ?? 0) + 1);
      counts.set(fixture.awayClubId, (counts.get(fixture.awayClubId) ?? 0) + 1);
      pairCounts.set(
        [fixture.homeClubId, fixture.awayClubId].sort().join(":"),
        (pairCounts.get([fixture.homeClubId, fixture.awayClubId].sort().join(":")) ?? 0) + 1,
      );
    }

    expect(new Set(fixtures.map((fixture) => fixture.round)).size).toBe(39);
    expect(fixtures).toHaveLength(273);
    expect([...counts.values()].every((count) => count === 39)).toBe(true);
    expect([...pairCounts.values()].every((count) => count === 3)).toBe(true);
  });

  it("creates a simplified K2 double-round-robin schedule with byes", () => {
    const fixtures = generateLeagueFixtures(FICTIONAL_LEAGUES[K2_LEAGUE_ID], { seasonNumber: 1 });
    const counts = new Map<string, number>();

    for (const fixture of fixtures) {
      counts.set(fixture.homeClubId, (counts.get(fixture.homeClubId) ?? 0) + 1);
      counts.set(fixture.awayClubId, (counts.get(fixture.awayClubId) ?? 0) + 1);
    }

    expect(new Set(fixtures.map((fixture) => fixture.round)).size).toBe(34);
    expect(fixtures).toHaveLength(272);
    expect([...counts.values()].every((count) => count === 32)).toBe(true);
  });

  it("gives every generated league fixture a valid weekend ISO date", () => {
    const fixtures = [
      ...generateLeagueFixtures(FICTIONAL_LEAGUES[K1_LEAGUE_ID], { seasonNumber: 1 }),
      ...generateLeagueFixtures(FICTIONAL_LEAGUES[K2_LEAGUE_ID], { seasonNumber: 1 }),
      ...generateLeagueFixtures(FICTIONAL_LEAGUES[K3_LEAGUE_ID], { seasonNumber: 1 }),
      ...generateLeagueFixtures(FICTIONAL_LEAGUES[K4_LEAGUE_ID], { seasonNumber: 1 }),
    ];

    expect(fixtures.every((fixture) => !Number.isNaN(new Date(fixture.date).getTime()))).toBe(true);
    expect(fixtures.every((fixture) => [0, 6].includes(new Date(fixture.date).getUTCDay()))).toBe(true);
    expect(new Date(fixtures[0].date).getUTCMonth()).toBe(1);
    expect(new Date(fixtures[0].date).getUTCDate()).toBeGreaterThanOrEqual(24);
  });

  it("keeps rounds chronological and avoids self matches", () => {
    const fixtures = generateLeagueFixtures(FICTIONAL_LEAGUES[K1_LEAGUE_ID], { seasonNumber: 1 });
    const roundDates = [...new Set(fixtures.map((fixture) => fixture.round))].map((round) => {
      const roundFixtures = fixtures.filter((fixture) => fixture.round === round);
      return Math.min(...roundFixtures.map((fixture) => new Date(fixture.date).getTime()));
    });

    expect(fixtures.every((fixture) => fixture.homeClubId !== fixture.awayClubId)).toBe(true);
    expect(roundDates.every((date, index) => index === 0 || date > roundDates[index - 1])).toBe(true);
  });

  it("does not use exact real K League club names", () => {
    const realClubNames = new Set([
      "FC 서울",
      "울산 HD",
      "전북 현대 모터스",
      "포항 스틸러스",
      "수원 삼성 블루윙즈",
      "수원 FC",
      "제주 유나이티드",
      "김천 상무",
      "대구 FC",
      "대전 하나 시티즌",
      "광주 FC",
      "강원 FC",
      "인천 유나이티드",
      "부산 아이파크",
      "부천 FC 1995",
      "성남 FC",
      "FC 안양",
      "충남 아산 FC",
      "경남 FC",
      "안산 그리너스",
      "전남 드래곤즈",
      "서울 이랜드 FC",
      "김포 FC",
      "천안 시티 FC",
      "청주 FC",
      "화성 FC",
      "Seoul FC",
      "Ulsan HD",
      "Jeonbuk Hyundai Motors",
      "Pohang Steelers",
      "Suwon Samsung Bluewings",
      "Jeju United",
    ]);
    const clubNames = Object.values(FICTIONAL_LEAGUES).flatMap((league) => league.clubs.map((club) => club.name));

    for (const name of clubNames) {
      expect(realClubNames.has(name)).toBe(false);
    }
  });
});
