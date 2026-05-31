import { describe, expect, it } from "vitest";
import type { Attributes, Player } from "../domain/types";
import { calculateOverall } from "../game/overall";

const attributes: Attributes = {
  technical: {
    finishing: 78,
    passing: 48,
    dribbling: 62,
    defending: 34,
    firstTouch: 70,
  },
  physical: {
    pace: 72,
    stamina: 58,
    strength: 57,
    agility: 66,
  },
  mental: {
    decisions: 61,
    composure: 75,
    workRate: 56,
    teamwork: 50,
  },
  career: {
    professionalism: 64,
    adaptability: 55,
    leadership: 42,
    marketability: 50,
  },
};

const player: Player = {
  id: "player-test",
  name: "테스트",
  nationality: "대한민국",
  age: 18,
  selectedPosition: "ST",
  recommendedPositions: [],
  dominantFoot: "right",
  OVR: 67,
  form: 50,
  condition: 82,
  fatigue: 14,
  reputation: 28,
  coachTrust: 42,
  marketValue: 0,
  position: "ST",
  personality: "diligent",
  clubId: "club",
  potential: 88,
  leftFoot: 10,
  rightFoot: 20,
  attributes,
};

describe("calculateOverall", () => {
  it("scores a finisher higher as ST than CB", () => {
    expect(calculateOverall(player, "ST")).toBeGreaterThan(calculateOverall(player, "CB"));
  });

  it("keeps OVR inside the 1 to 99 range", () => {
    const ovr = calculateOverall(player, "ST");

    expect(ovr).toBeGreaterThanOrEqual(1);
    expect(ovr).toBeLessThanOrEqual(99);
  });
});
