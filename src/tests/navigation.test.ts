import { describe, expect, it } from "vitest";
import type { PlayerProfile } from "../domain/player";
import { createPlayerProfile } from "../domain/player";
import { getInitialScreen } from "../game/navigation";

describe("getInitialScreen", () => {
  it("starts on the start screen without a saved player", () => {
    expect(getInitialScreen(null)).toBe("start");
  });

  it("opens the dashboard when a saved player exists", () => {
    const player: PlayerProfile = createPlayerProfile("테스트", "striker", "han-river-fc");

    expect(getInitialScreen(player)).toBe("dashboard");
  });
});
