import { describe, expect, it } from "vitest";
import { generatePlayerRoll } from "../game/playerGeneration";

describe("generatePlayerRoll", () => {
  it("creates a deterministic youth player roll from a seed", () => {
    const first = generatePlayerRoll("seed-a");
    const second = generatePlayerRoll("seed-a");

    expect(second).toEqual(first);
    expect(first.age).toBeGreaterThanOrEqual(16);
    expect(first.age).toBeLessThanOrEqual(20);
    expect(first.potential).toBeGreaterThanOrEqual(72);
    expect(first.potential).toBeLessThanOrEqual(95);
    expect(first.recommendations).toHaveLength(8);
  });

  it("sets exactly one dominant foot to 20 and keeps the weaker foot below 20", () => {
    const roll = generatePlayerRoll("footedness");
    const footValues = [roll.leftFoot, roll.rightFoot];

    expect(footValues.filter((value) => value === 20)).toHaveLength(1);
    expect(roll.dominantFoot === "left" ? roll.leftFoot : roll.rightFoot).toBe(20);
    expect(Math.min(...footValues)).toBeGreaterThanOrEqual(1);
    expect(Math.min(...footValues)).toBeLessThanOrEqual(18);
  });

  it("always rolls ages from 16 to 20", () => {
    for (let index = 0; index < 100; index += 1) {
      const roll = generatePlayerRoll(`age-${index}`);

      expect(roll.age).toBeGreaterThanOrEqual(16);
      expect(roll.age).toBeLessThanOrEqual(20);
    }
  });

  it("keeps all generated attributes inside valid ranges", () => {
    for (let index = 0; index < 50; index += 1) {
      const roll = generatePlayerRoll(`attributes-${index}`);
      const values = [
        ...Object.values(roll.attributes.technical),
        ...Object.values(roll.attributes.physical),
        ...Object.values(roll.attributes.mental),
        ...Object.values(roll.attributes.career),
      ];

      expect(values.every((value) => value >= 1 && value <= 99)).toBe(true);
    }
  });

  it("rolls valid potential with growth room over current OVR", () => {
    for (let index = 0; index < 50; index += 1) {
      const roll = generatePlayerRoll(`potential-${index}`);
      const topOverall = roll.recommendations[0].overall;

      expect(roll.potential).toBeGreaterThanOrEqual(72);
      expect(roll.potential).toBeLessThanOrEqual(95);
      expect(roll.potential).toBeGreaterThanOrEqual(topOverall);
    }
  });
});
