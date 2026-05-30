import { describe, expect, it } from "vitest";
import type { KeyMoment, PlayerMatchStats } from "../domain/types";
import { calculatePlayerRating } from "../game/rating";

const baseStats: PlayerMatchStats = {
  minutesPlayed: 84,
  goals: 0,
  assists: 0,
  shots: 1,
  keyPasses: 1,
  tackles: 1,
  turnovers: 1,
};

const successfulMoment: KeyMoment = {
  id: "moment-1",
  minute: 67,
  situation: "chance",
  choices: [
    {
      id: "run",
      label: "run",
      attributeFocus: "technical.finishing",
      risk: "high",
    },
  ],
  selectedChoiceId: "run",
  outcome: {
    successful: true,
    chance: 68,
    roll: 20,
    description: "success",
    ratingModifier: 0.45,
    stats: { goals: 1, shots: 1 },
  },
};

const failedMoment: KeyMoment = {
  ...successfulMoment,
  id: "moment-2",
  outcome: {
    successful: false,
    chance: 45,
    roll: 80,
    description: "failure",
    ratingModifier: -0.35,
    stats: { turnovers: 1 },
  },
};

describe("calculatePlayerRating", () => {
  it("keeps ratings inside the 1.0 to 10.0 range", () => {
    const result = calculatePlayerRating({
      stats: {
        ...baseStats,
        goals: 8,
        assists: 5,
        shots: 15,
        keyPasses: 12,
        tackles: 8,
        turnovers: 0,
      },
      keyMoments: [successfulMoment, successfulMoment, successfulMoment],
      teamGoalsFor: 9,
      teamGoalsAgainst: 0,
      condition: 100,
      fatigue: 0,
      form: 100,
    });

    expect(result.rating).toBeLessThanOrEqual(10);
    expect(result.rating).toBeGreaterThanOrEqual(1);
  });

  it("rewards positive attacking contributions", () => {
    const quietGame = calculatePlayerRating({
      stats: baseStats,
      keyMoments: [],
      teamGoalsFor: 1,
      teamGoalsAgainst: 1,
      condition: 75,
      fatigue: 20,
      form: 50,
    });
    const strongGame = calculatePlayerRating({
      stats: { ...baseStats, goals: 1, assists: 1, shots: 3, keyPasses: 3, turnovers: 0 },
      keyMoments: [successfulMoment],
      teamGoalsFor: 3,
      teamGoalsAgainst: 1,
      condition: 75,
      fatigue: 20,
      form: 50,
    });

    expect(strongGame.rating).toBeGreaterThan(quietGame.rating);
    expect(strongGame.modifiers.some((modifier) => modifier.kind === "positive")).toBe(true);
  });

  it("applies negative modifiers for turnovers, fatigue, and failed moments", () => {
    const result = calculatePlayerRating({
      stats: { ...baseStats, turnovers: 5 },
      keyMoments: [failedMoment],
      teamGoalsFor: 0,
      teamGoalsAgainst: 2,
      condition: 55,
      fatigue: 70,
      form: 35,
    });

    expect(result.rating).toBeLessThan(6);
    expect(result.modifiers.some((modifier) => modifier.kind === "negative")).toBe(true);
  });
});
