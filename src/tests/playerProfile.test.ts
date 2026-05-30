import { describe, expect, it } from "vitest";
import {
  createPlayerProfile,
  getPlayStylesForPosition,
  isPlayStyleValidForPosition,
  validatePlayerCreationInput,
  type PlayerCreationInput,
} from "../domain/player";

const VALID_INPUT: PlayerCreationInput = {
  name: "강민재",
  nationality: "대한민국",
  age: 18,
  preferredFoot: "right",
  position: "ST",
  playStyle: "poacher",
  personality: "diligent",
  clubId: "greenhill-fc",
};

describe("createPlayerProfile", () => {
  it("creates a player with creation choices and generated attributes", () => {
    const player = createPlayerProfile(VALID_INPUT);

    expect(player.name).toBe("강민재");
    expect(player.nationality).toBe("대한민국");
    expect(player.age).toBe(18);
    expect(player.position).toBe("ST");
    expect(player.playStyle).toBe("poacher");
    expect(player.personality).toBe("diligent");
    expect(player.attributes.technical.finishing).toBeGreaterThan(60);
  });

  it("keeps play style options tied to the selected position", () => {
    expect(getPlayStylesForPosition("CB").map((option) => option.id)).toEqual([
      "stopper",
      "ballPlayingDefender",
    ]);
    expect(isPlayStyleValidForPosition("CB", "stopper")).toBe(true);
    expect(isPlayStyleValidForPosition("CB", "poacher")).toBe(false);
  });
});

describe("validatePlayerCreationInput", () => {
  it("returns validation errors for invalid player creation input", () => {
    const errors = validatePlayerCreationInput(
      {
        ...VALID_INPUT,
        name: "A",
        nationality: "",
        age: 20,
        position: "CB",
        playStyle: "poacher",
        clubId: "unknown-club",
      },
      ["greenhill-fc"],
    );

    expect(errors).toHaveLength(5);
  });
});
