import { describe, expect, it } from "vitest";
import { STARTER_CLUBS } from "../data/fictionalLeagues";
import { advanceMonth, createNewCareer } from "../game/monthlyCareer";
import { MONTHLY_EVENT_TYPES } from "../game/monthlyEvents";
import { generatePlayerRoll } from "../game/playerGeneration";

function createCareer() {
  const roll = generatePlayerRoll("monthly-career");

  return createNewCareer({
    name: "월간 테스트",
    nationality: "대한민국",
    clubId: STARTER_CLUBS[0].id,
    position: roll.recommendations[0].position,
    roll,
  });
}

describe("monthly career loop", () => {
  it("creates a v2 monthly career with optional monthly event state", () => {
    const career = createCareer();

    expect(career.saveVersion).toBe(2);
    expect(career.season.currentMonth).toBe(1);
    expect(career.season.fixtures.length).toBeGreaterThan(500);
    expect(career.eventLog[0]?.type).toBe("career_start");

    if (career.currentEvent) {
      expect(MONTHLY_EVENT_TYPES).toContain(career.currentEvent.type);
      expect(career.currentEvent.choices.length).toBeGreaterThanOrEqual(2);
      expect(career.currentEvent.choices.length).toBeLessThanOrEqual(4);
    }
  });

  it("simulates fixtures, applies growth, logs the month, and advances one month", () => {
    const career = createCareer();
    const choiceId = career.currentEvent?.choices[0].id;
    const advanced = advanceMonth(career, { selectedChoiceId: choiceId });

    expect(advanced.season.currentMonth).toBe(2);
    expect(advanced.season.fixtures.some((fixture) => fixture.status === "played")).toBe(true);
    expect(advanced.monthlyDevelopmentLog.length).toBeGreaterThan(0);
    expect(advanced.eventLog.length).toBeGreaterThan(career.eventLog.length);
    expect(advanced.eventLog.some((entry) => entry.type === "monthly_summary")).toBe(true);

    if (advanced.currentEvent) {
      expect(advanced.currentEvent.month).toBe(2);
      expect(MONTHLY_EVENT_TYPES).toContain(advanced.currentEvent.type);
      expect(advanced.currentEvent.choices.length).toBeGreaterThanOrEqual(2);
      expect(advanced.currentEvent.choices.length).toBeLessThanOrEqual(4);
    }
  });
});
