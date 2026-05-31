import { describe, expect, it } from "vitest";
import { FICTIONAL_LEAGUES, K1_CLUBS, K1_LEAGUE_ID, K2_LEAGUE_ID } from "../data/fictionalLeagues";
import { generateLeagueFixtures } from "../game/leagueSchedule";

describe("generateLeagueFixtures", () => {
  it("defines a 14-club fictional Korean first division", () => {
    expect(FICTIONAL_LEAGUES[K1_LEAGUE_ID].id).toBe("k1_fictional");
    expect(FICTIONAL_LEAGUES[K1_LEAGUE_ID].name).toBe("코리아 프리미어 1");
    expect(K1_CLUBS).toHaveLength(14);
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
