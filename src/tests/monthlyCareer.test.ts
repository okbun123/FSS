import { describe, expect, it } from "vitest";
import { K1_CLUBS, K2_CLUBS, STARTER_CLUBS } from "../data/fictionalLeagues";
import {
  advanceWeek,
  createNewCareer,
  getCurrentWeekFixtures,
  getCurrentWeekPlayerFixtures,
  resolveActiveMatch,
} from "../game/monthlyCareer";
import { MONTHLY_EVENT_TYPES } from "../game/monthlyEvents";
import { generatePlayerRoll } from "../game/playerGeneration";

function createCareer(clubId = STARTER_CLUBS[0].id, seed = "weekly-career") {
  const roll = generatePlayerRoll(seed);

  return createNewCareer({
    name: "주간 테스트",
    nationality: "대한민국",
    clubId,
    position: roll.recommendations[0].position,
    roll,
  });
}

describe("weekly career loop", () => {
  it("creates a v3 weekly career with optional monthly event state", () => {
    const career = createCareer();

    expect(career.saveVersion).toBe(3);
    expect(career.season.currentMonth).toBeGreaterThanOrEqual(2);
    expect(career.season.fixtures.length).toBeGreaterThan(500);
    expect(career.eventLog[0]?.type).toBe("career_start");

    if (career.currentEvent) {
      expect(MONTHLY_EVENT_TYPES).toContain(career.currentEvent.type);
      expect(career.currentEvent.choices.length).toBeGreaterThanOrEqual(2);
      expect(career.currentEvent.choices.length).toBeLessThanOrEqual(4);
    }
  });

  it("creates a new CareerState with valid ISO date fields", () => {
    const career = createCareer();
    const currentDate = new Date(career.currentDate);
    const weekStartDate = new Date(career.currentWeekStartDate);

    expect(currentDate.toISOString()).toBe(career.currentDate);
    expect(weekStartDate.toISOString()).toBe(career.currentWeekStartDate);
    expect(weekStartDate.getTime()).toBeLessThanOrEqual(currentDate.getTime());
    expect(career.fixtures[0]?.date).toBe(career.season.fixtures[0]?.date);
    expect(new Date(career.fixtures[0]?.date ?? "").toString()).not.toBe("Invalid Date");
    expect(career.weekTurns[0]?.startDate).toBe(career.currentWeekStartDate);
  });

  it("detects fixtures in the current week by exact date", () => {
    const career = createCareer(K1_CLUBS[0].id, "weekly-detection");
    const weekFixtures = getCurrentWeekFixtures(career);
    const playerFixtures = getCurrentWeekPlayerFixtures(career);
    const weekStart = new Date(career.currentDate).getTime();
    const weekEndExclusive = weekStart + 7 * 24 * 60 * 60 * 1000;

    expect(weekFixtures.length).toBeGreaterThan(0);
    expect(playerFixtures.length).toBeGreaterThan(0);
    expect(
      weekFixtures.every((fixture) => {
        const fixtureTime = new Date(fixture.date).getTime();
        return fixtureTime >= weekStart && fixtureTime < weekEndExclusive;
      }),
    ).toBe(true);
  });

  it("opens the match screen state before completing a week with a player fixture", () => {
    const career = createCareer(K1_CLUBS[2].id, "weekly-active-match");
    const advanced = advanceWeek(career, { selectedChoiceId: career.currentEvent?.choices[0]?.id });
    const activeFixture = advanced.fixtures.find((fixture) => fixture.matchId === advanced.activeMatchId);

    expect(advanced.currentDate).toBe(career.currentDate);
    expect(advanced.activeMatchId).toBeDefined();
    expect(activeFixture?.status).toBe("inProgress");
    expect(
      advanced.fixtures
        .filter((fixture) => fixture.status === "played")
        .every((fixture) => fixture.date <= (activeFixture?.date ?? fixture.date)),
    ).toBe(true);
  });

  it("resolves the active match before completing the week", () => {
    const career = createCareer(K1_CLUBS[0].id, "weekly-resolve-match");
    const active = advanceWeek(career);
    const resolved = resolveActiveMatch(active);

    expect(active.activeMatchId).toBeDefined();
    expect(resolved.activeMatchId).toBeUndefined();
    expect(new Date(resolved.currentDate).getTime()).toBe(
      new Date(career.currentDate).getTime() + 7 * 24 * 60 * 60 * 1000,
    );
    expect(resolved.fixtures.some((fixture) => fixture.status === "played")).toBe(true);
    expect(resolved.eventLog.some((entry) => entry.type === "weekly_summary")).toBe(true);

    if (resolved.currentEvent) {
      expect(MONTHLY_EVENT_TYPES).toContain(resolved.currentEvent.type);
      expect(resolved.currentEvent.choices.length).toBeGreaterThanOrEqual(2);
      expect(resolved.currentEvent.choices.length).toBeLessThanOrEqual(4);
    }
  });

  it("completes a bye week without opening a match", () => {
    const career = createCareer(K2_CLUBS[0].id, "weekly-bye");
    const advanced = advanceWeek(career);

    expect(getCurrentWeekPlayerFixtures(career)).toHaveLength(0);
    expect(advanced.activeMatchId).toBeUndefined();
    expect(new Date(advanced.currentDate).getTime()).toBe(
      new Date(career.currentDate).getTime() + 7 * 24 * 60 * 60 * 1000,
    );
  });
});
