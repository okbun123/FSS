import { describe, expect, it } from "vitest";
import type { Attributes, Player } from "../domain/types";
import {
  calculatePositionRecommendations,
  POSITION_FIT_WEIGHTS,
} from "../domain/positionRecommendation";
import { recommendPositions } from "../game/positionRecommendation";

type AttributeOverrides = {
  technical?: Partial<Attributes["technical"]>;
  physical?: Partial<Attributes["physical"]>;
  mental?: Partial<Attributes["mental"]>;
  career?: Partial<Attributes["career"]>;
};

function attributes(overrides: AttributeOverrides = {}): Attributes {
  return {
    technical: {
      finishing: 42,
      shooting: 42,
      passing: 42,
      dribbling: 42,
      defending: 42,
      firstTouch: 42,
      crossing: 42,
      tackling: 42,
      marking: 42,
      heading: 42,
      ...overrides.technical,
    },
    physical: {
      pace: 42,
      speed: 42,
      acceleration: 42,
      stamina: 42,
      strength: 42,
      agility: 42,
      ...overrides.physical,
    },
    mental: {
      decisions: 42,
      composure: 42,
      concentration: 42,
      workRate: 42,
      teamwork: 42,
      ...overrides.mental,
    },
    career: {
      professionalism: 50,
      adaptability: 50,
      leadership: 42,
      marketability: 42,
      ...overrides.career,
    },
  };
}

function player(attributeSet: Attributes, leftFoot = 9, rightFoot = 20): Player {
  return {
    id: "player-test",
    name: "테스트",
    nationality: "대한민국",
    age: 18,
    selectedPosition: "ST",
    recommendedPositions: [],
    attributes: attributeSet,
    leftFoot,
    rightFoot,
    dominantFoot: leftFoot === 20 && rightFoot === 20 ? "both" : leftFoot === 20 ? "left" : "right",
    OVR: 50,
    potential: 88,
    form: 50,
    condition: 82,
    fatigue: 10,
    reputation: 25,
    coachTrust: 40,
    marketValue: 0,
    clubId: "club-test",
    personality: "diligent",
    position: "ST",
  };
}

describe("POSITION_FIT_WEIGHTS", () => {
  it("keeps every position weight total at 100 percent", () => {
    for (const weights of Object.values(POSITION_FIT_WEIGHTS)) {
      const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);

      expect(total).toBeCloseTo(1, 5);
    }
  });
});

describe("calculatePositionRecommendations", () => {
  it("returns all positions sorted and marks only the top three as recommended", () => {
    const recommendations = calculatePositionRecommendations(
      player(
        attributes({
          technical: { finishing: 82, shooting: 78, firstTouch: 76 },
          physical: { speed: 72, strength: 74 },
          mental: { composure: 80 },
        }),
      ),
    );

    expect(recommendations).toHaveLength(8);
    expect(recommendations.map((recommendation) => recommendation.fitScore)).toEqual(
      [...recommendations].map((recommendation) => recommendation.fitScore).sort((left, right) => right - left),
    );
    expect(recommendations.filter((recommendation) => recommendation.isRecommended)).toHaveLength(3);
    expect(recommendations.slice(0, 3).every((recommendation) => recommendation.isRecommended)).toBe(true);
    expect(recommendations.slice(3).every((recommendation) => !recommendation.isRecommended)).toBe(true);
  });

  it("uses the top two strengths and weakest relevant attribute in Korean explanation text", () => {
    const [recommendation] = calculatePositionRecommendations(
      player(
        attributes({
          technical: { finishing: 88, shooting: 86, firstTouch: 35 },
          physical: { speed: 70, strength: 76 },
          mental: { composure: 82 },
        }),
      ),
    );

    expect(recommendation.keyStrengths).toHaveLength(2);
    expect(recommendation.keyWeaknesses).toHaveLength(1);
    expect(recommendation.reason).toContain(recommendation.keyStrengths[0]);
    expect(recommendation.reason).toContain(recommendation.keyStrengths[1]);
    expect(recommendation.reason).toContain(recommendation.keyWeaknesses[0]);
    expect(recommendation.explanationKo).toBe(recommendation.reason);
  });

  it.each([
    [
      "clinical striker",
      "ST",
      attributes({
        technical: { finishing: 90, shooting: 88, heading: 82, firstTouch: 80 },
        physical: { speed: 76, strength: 84 },
        mental: { composure: 86 },
      }),
      9,
      20,
    ],
    [
      "right-sided winger",
      "RW",
      attributes({
        technical: { dribbling: 90, crossing: 84, firstTouch: 80, passing: 76 },
        physical: { speed: 92, acceleration: 90, agility: 86 },
        mental: { decisions: 64 },
      }),
      9,
      20,
    ],
    [
      "attacking creator",
      "AM",
      attributes({
        technical: { passing: 90, dribbling: 84, firstTouch: 88, shooting: 72 },
        physical: { agility: 78, stamina: 58 },
        mental: { decisions: 90, composure: 82 },
      }),
      12,
      20,
    ],
    [
      "central engine",
      "CM",
      attributes({
        technical: { passing: 86, firstTouch: 80, tackling: 74 },
        physical: { stamina: 88, strength: 58 },
        mental: { decisions: 86, concentration: 82, composure: 80 },
      }),
      12,
      20,
    ],
    [
      "defensive midfielder",
      "DM",
      attributes({
        technical: { tackling: 90, marking: 86, passing: 76 },
        physical: { stamina: 86, strength: 88 },
        mental: { concentration: 88, decisions: 78, composure: 62 },
      }),
      12,
      20,
    ],
    [
      "overlapping fullback",
      "FB",
      attributes({
        technical: { crossing: 88, tackling: 82, marking: 80, passing: 76 },
        physical: { speed: 88, acceleration: 84, stamina: 92, strength: 52 },
        mental: { concentration: 62 },
      }),
      20,
      11,
    ],
    [
      "center back",
      "CB",
      attributes({
        technical: { marking: 90, tackling: 88, heading: 88, passing: 58 },
        physical: { strength: 90, stamina: 66 },
        mental: { concentration: 86, composure: 80 },
      }),
      10,
      20,
    ],
  ] as const)("recommends %s archetype as %s", (_label, expectedPosition, attributeSet, leftFoot, rightFoot) => {
    const [recommendation] = calculatePositionRecommendations(player(attributeSet, leftFoot, rightFoot));

    expect(recommendation.position).toBe(expectedPosition);
  });
});

describe("recommendPositions", () => {
  it("returns the top three recommendations for creation previews", () => {
    const recommendations = recommendPositions({
      attributes: attributes({
        technical: { dribbling: 82, crossing: 78, firstTouch: 76, passing: 72 },
        physical: { speed: 86, acceleration: 84, agility: 80 },
      }),
      potential: 90,
      leftFoot: 10,
      rightFoot: 20,
      dominantFoot: "right",
    });

    expect(recommendations).toHaveLength(3);
    expect(recommendations.every((recommendation) => recommendation.isRecommended)).toBe(true);
  });
});
