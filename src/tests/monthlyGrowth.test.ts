import { describe, expect, it } from "vitest";
import { STARTER_CLUBS } from "../data/fictionalLeagues";
import type { Club } from "../domain/types";
import { createNewCareer } from "../game/monthlyCareer";
import { calculateMonthlyGrowthAmount, createMonthlyDevelopmentReport } from "../game/monthlyGrowth";
import { generatePlayerRoll } from "../game/playerGeneration";

function createCareer() {
  const roll = generatePlayerRoll("growth-career");

  return createNewCareer({
    name: "성장 테스트",
    nationality: "대한민국",
    clubId: STARTER_CLUBS[0].id,
    position: roll.recommendations[0].position,
    roll,
  });
}

function withFacilities(club: Club, value: number): Club {
  return {
    ...club,
    trainingFacilities: {
      technicalTraining: value,
      physicalTraining: value,
      tacticalTraining: value,
      mentalTraining: value,
      youthDevelopment: value,
      medicalSupport: value,
    },
  };
}

function totalGrowth(report: ReturnType<typeof createMonthlyDevelopmentReport>): number {
  return report?.entries.reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
}

describe("monthly growth", () => {
  it("uses club facilities and player context to produce growth", () => {
    const career = createCareer();
    const report = createMonthlyDevelopmentReport(career, STARTER_CLUBS[0], {
      month: 1,
      playingTimeShare: 0.7,
      createdAt: "2027-01-01T00:00:00.000Z",
    });

    expect(report?.entries.length).toBeGreaterThan(0);
    expect(report?.month).toBe(1);
  });

  it("slows growth when injury penalty is low", () => {
    const healthy = calculateMonthlyGrowthAmount({
      age: 17,
      potential: 90,
      professionalism: 70,
      currentValue: 55,
      facilityValue: 80,
      playingTimeShare: 0.6,
      form: 60,
      fatigue: 20,
      injuryPenalty: 1,
      baseRate: 0.2,
    });
    const injured = calculateMonthlyGrowthAmount({
      age: 17,
      potential: 90,
      professionalism: 70,
      currentValue: 55,
      facilityValue: 80,
      playingTimeShare: 0.6,
      form: 60,
      fatigue: 20,
      injuryPenalty: 0.3,
      baseRate: 0.2,
    });

    expect(healthy).toBeGreaterThan(injured);
  });

  it("produces better growth with stronger training facilities", () => {
    const career = createCareer();
    const lowFacilityReport = createMonthlyDevelopmentReport(career, withFacilities(STARTER_CLUBS[0], 30), {
      month: 1,
      playingTimeShare: 0.55,
      createdAt: "2027-01-01T00:00:00.000Z",
    });
    const highFacilityReport = createMonthlyDevelopmentReport(career, withFacilities(STARTER_CLUBS[0], 90), {
      month: 1,
      playingTimeShare: 0.55,
      createdAt: "2027-01-01T00:00:00.000Z",
    });

    expect(totalGrowth(highFacilityReport)).toBeGreaterThan(totalGrowth(lowFacilityReport));
  });

  it("reduces monthly growth when fatigue is high", () => {
    const career = createCareer();
    const restedReport = createMonthlyDevelopmentReport(
      { ...career, fatigue: 12, player: { ...career.player, fatigue: 12 } },
      STARTER_CLUBS[0],
      { month: 1, playingTimeShare: 0.55 },
    );
    const tiredReport = createMonthlyDevelopmentReport(
      { ...career, fatigue: 85, player: { ...career.player, fatigue: 85 } },
      STARTER_CLUBS[0],
      { month: 1, playingTimeShare: 0.55 },
    );

    expect(totalGrowth(restedReport)).toBeGreaterThan(totalGrowth(tiredReport));
  });

  it("grows younger players faster than older youth players", () => {
    const career = createCareer();
    const youngerReport = createMonthlyDevelopmentReport(
      { ...career, player: { ...career.player, age: 16 } },
      STARTER_CLUBS[0],
      { month: 1, playingTimeShare: 0.55 },
    );
    const olderReport = createMonthlyDevelopmentReport(
      { ...career, player: { ...career.player, age: 20 } },
      STARTER_CLUBS[0],
      { month: 1, playingTimeShare: 0.55 },
    );

    expect(totalGrowth(youngerReport)).toBeGreaterThan(totalGrowth(olderReport));
  });
});
