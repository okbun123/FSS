import { describe, expect, it } from "vitest";
import { createPlayerProfile } from "../domain/player";

describe("createPlayerProfile", () => {
  it("normalizes empty player names", () => {
    const player = createPlayerProfile("   ", "midfielder", "lumina-city");

    expect(player.name).toBe("이름 없는 선수");
    expect(player.age).toBe(18);
    expect(player.attributes.technical.passing).toBeGreaterThan(0);
  });

  it("keeps the selected position and club", () => {
    const player = createPlayerProfile("강민재", "defender", "coral-harbor");

    expect(player.position).toBe("defender");
    expect(player.clubId).toBe("coral-harbor");
  });
});
