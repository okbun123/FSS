import { describe, expect, it } from "vitest";
import { createPlayerProfile } from "../domain/player";

describe("createPlayerProfile", () => {
  it("normalizes empty player names", () => {
    const player = createPlayerProfile("   ", "midfielder", "han-river-fc");

    expect(player.name).toBe("이름 없는 선수");
    expect(player.age).toBe(18);
  });

  it("keeps the selected position and club", () => {
    const player = createPlayerProfile("강민재", "defender", "blue-harbor");

    expect(player.position).toBe("defender");
    expect(player.clubId).toBe("blue-harbor");
  });
});
