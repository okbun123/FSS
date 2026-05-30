import { describe, expect, it } from "vitest";
import { STARTER_CLUBS } from "../data/clubs";
import { createNewCareer } from "../game/career";
import { getInitialScreen } from "../game/navigation";

describe("getInitialScreen", () => {
  it("starts on the start screen without a saved career", () => {
    expect(getInitialScreen(null)).toBe("start");
  });

  it("opens the dashboard when a saved career exists", () => {
    const career = createNewCareer({
      name: "테스트",
      nationality: "대한민국",
      age: 18,
      preferredFoot: "right",
      position: "ST",
      playStyle: "poacher",
      personality: "diligent",
      clubId: STARTER_CLUBS[0].id,
    });

    expect(getInitialScreen(career)).toBe("dashboard");
  });
});
