import { describe, expect, it } from "vitest";
import { STARTER_CLUBS } from "../data/clubs";
import { createNewCareer } from "../game/career";
import {
  applyDevelopmentReport,
  applyMatchGrowth,
  applyWeeklyGrowth,
  calculateGrowthAmount,
} from "../game/growth";

function createCareer(age = 18) {
  return createNewCareer({
    name: "Growth",
    nationality: "KOR",
    age,
    preferredFoot: "right",
    position: "ST",
    playStyle: "poacher",
    personality: "diligent",
    clubId: STARTER_CLUBS[0].id,
  });
}

describe("calculateGrowthAmount", () => {
  it("grows younger players faster", () => {
    const young = calculateGrowthAmount({
      age: 16,
      potential: 90,
      professionalism: 60,
      fatigue: 10,
      condition: 85,
      currentValue: 55,
      baseRate: 0.5,
    });
    const older = calculateGrowthAmount({
      age: 19,
      potential: 90,
      professionalism: 60,
      fatigue: 10,
      condition: 85,
      currentValue: 55,
      baseRate: 0.5,
    });

    expect(young).toBeGreaterThan(older);
  });

  it("reduces growth with high fatigue and poor condition", () => {
    const fresh = calculateGrowthAmount({
      age: 18,
      potential: 90,
      professionalism: 60,
      fatigue: 5,
      condition: 90,
      currentValue: 55,
      baseRate: 0.5,
    });
    const tired = calculateGrowthAmount({
      age: 18,
      potential: 90,
      professionalism: 60,
      fatigue: 85,
      condition: 45,
      currentValue: 55,
      baseRate: 0.5,
    });

    expect(fresh).toBeGreaterThan(tired);
  });

  it("slows growth near potential", () => {
    const roomToGrow = calculateGrowthAmount({
      age: 18,
      potential: 90,
      professionalism: 60,
      fatigue: 10,
      condition: 85,
      currentValue: 55,
      baseRate: 0.5,
    });
    const nearPotential = calculateGrowthAmount({
      age: 18,
      potential: 90,
      professionalism: 60,
      fatigue: 10,
      condition: 85,
      currentValue: 89,
      baseRate: 0.5,
    });

    expect(roomToGrow).toBeGreaterThan(nearPotential);
  });
});

describe("growth application", () => {
  it("applies slow weekly training growth and records a report", () => {
    const career = createCareer(17);
    const updatedCareer = applyWeeklyGrowth(career, {
      actionType: "individualTraining",
      attributeFocus: "technical.finishing",
      createdAt: "2026-05-31T00:00:00.000Z",
    });

    expect(updatedCareer.player.attributes.technical.finishing).toBeGreaterThan(
      career.player.attributes.technical.finishing,
    );
    expect(updatedCareer.player.attributes.technical.finishing).toBeLessThan(
      career.player.attributes.technical.finishing + 1,
    );
    expect(updatedCareer.developmentLog).toHaveLength(1);
    expect(updatedCareer.developmentLog[0].entries[0].attribute).toBe("technical.finishing");
  });

  it("caps attributes at 100", () => {
    const career = createCareer(16);
    const report = {
      id: "cap-test",
      week: career.currentWeek,
      source: "weeklyTraining" as const,
      title: "cap",
      createdAt: "2026-05-31T00:00:00.000Z",
      entries: [
        {
          attribute: "technical.finishing" as const,
          label: "결정력",
          before: 99.8,
          after: 120,
          amount: 20.2,
        },
      ],
    };
    const nearCapCareer = {
      ...career,
      player: {
        ...career.player,
        attributes: {
          ...career.player.attributes,
          technical: {
            ...career.player.attributes.technical,
            finishing: 99.8,
          },
        },
      },
    };
    const updatedCareer = applyDevelopmentReport(nearCapCareer, report);

    expect(updatedCareer.player.attributes.technical.finishing).toBe(100);
  });

  it("applies small match growth from match stats", () => {
    const career = createCareer(18);
    const updatedCareer = applyMatchGrowth(career, {
      rating: 7.4,
      stats: {
        minutesPlayed: 82,
        goals: 1,
        assists: 0,
        shots: 3,
        keyPasses: 1,
        tackles: 0,
        turnovers: 1,
      },
      createdAt: "2026-05-31T01:00:00.000Z",
    });

    expect(updatedCareer.player.attributes.technical.finishing).toBeGreaterThan(
      career.player.attributes.technical.finishing,
    );
    expect(updatedCareer.developmentLog.at(-1)?.source).toBe("match");
  });
});
