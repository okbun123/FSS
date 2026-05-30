import { describe, expect, it } from "vitest";
import { CLUBS, DEFAULT_LEAGUE } from "../data/clubs";
import { advanceWeek, createNewCareer, getCurrentWeek } from "../game/career";

describe("createNewCareer", () => {
  it("creates an initial career state with a player, league, and season", () => {
    const career = createNewCareer({
      playerName: "강민재",
      position: "striker",
      clubId: CLUBS[0].id,
    });

    expect(career.saveVersion).toBe(1);
    expect(career.player.name).toBe("강민재");
    expect(career.player.position).toBe("striker");
    expect(career.league.clubs).toHaveLength(8);
    expect(career.league.id).toBe(DEFAULT_LEAGUE.id);
    expect(career.season.matches).toHaveLength(56);
    expect(career.currentWeek).toBe(1);
  });

  it("exposes the current week and the player's scheduled match", () => {
    const career = createNewCareer({
      playerName: "테스트 선수",
      position: "midfielder",
      clubId: CLUBS[2].id,
    });
    const currentWeek = getCurrentWeek(career);

    expect(currentWeek.week).toBe(1);
    expect(currentWeek.matches).toHaveLength(4);
    expect(currentWeek.playerMatch).toBeDefined();
    expect(
      [currentWeek.playerMatch?.homeClubId, currentWeek.playerMatch?.awayClubId].includes(
        career.player.clubId,
      ),
    ).toBe(true);
  });
});

describe("advanceWeek", () => {
  it("returns a new career state advanced by one week", () => {
    const career = createNewCareer({
      playerName: "테스트 선수",
      position: "defender",
      clubId: CLUBS[1].id,
    });
    const advancedCareer = advanceWeek(career);

    expect(advancedCareer).not.toBe(career);
    expect(advancedCareer.currentWeek).toBe(2);
    expect(career.currentWeek).toBe(1);
    expect(advancedCareer.season.isComplete).toBe(false);
  });

  it("marks the season complete after the final week", () => {
    const career = createNewCareer({
      playerName: "테스트 선수",
      position: "goalkeeper",
      clubId: CLUBS[3].id,
    });
    const finalWeekCareer = {
      ...career,
      currentWeek: career.season.totalWeeks,
      season: { ...career.season, currentWeek: career.season.totalWeeks },
    };
    const completedCareer = advanceWeek(finalWeekCareer);

    expect(completedCareer.currentWeek).toBe(15);
    expect(completedCareer.season.isComplete).toBe(true);
    expect(getCurrentWeek(completedCareer).matches).toHaveLength(0);
  });
});
