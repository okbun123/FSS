import { describe, expect, it } from "vitest";
import { generateStartingAttributes, type PlayerCreationInput } from "../domain/player";

const baseInput: PlayerCreationInput = {
  name: "테스트 선수",
  nationality: "대한민국",
  age: 18,
  preferredFoot: "right",
  position: "ST",
  playStyle: "poacher",
  personality: "diligent",
  clubId: "greenhill-fc",
};

describe("generateStartingAttributes", () => {
  it("builds striker poacher attributes around finishing", () => {
    const attributes = generateStartingAttributes(baseInput);

    expect(attributes.technical.finishing).toBeGreaterThan(attributes.technical.passing);
    expect(attributes.technical.finishing).toBeGreaterThan(attributes.technical.defending);
  });

  it("builds center back stopper attributes around defending and strength", () => {
    const attributes = generateStartingAttributes({
      ...baseInput,
      position: "CB",
      playStyle: "stopper",
      personality: "teamPlayer",
    });

    expect(attributes.technical.defending).toBeGreaterThan(attributes.technical.finishing);
    expect(attributes.physical.strength).toBeGreaterThan(attributes.physical.pace);
    expect(attributes.mental.teamwork).toBeGreaterThan(55);
  });

  it("keeps every generated attribute inside the 1 to 99 range", () => {
    const attributes = generateStartingAttributes({
      ...baseInput,
      age: 19,
      position: "LW",
      playStyle: "insideForward",
      personality: "star",
    });
    const values = [
      ...Object.values(attributes.technical),
      ...Object.values(attributes.physical),
      ...Object.values(attributes.mental),
      ...Object.values(attributes.career),
    ];

    expect(values.every((value) => value >= 1 && value <= 99)).toBe(true);
  });
});
