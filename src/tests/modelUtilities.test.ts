import { describe, expect, it } from "vitest";
import { deriveDominantFoot } from "../domain/player";
import { STARTER_CLUBS } from "../data/fictionalLeagues";

describe("model utility functions", () => {
  it("derives dominant foot from foot stats", () => {
    expect(deriveDominantFoot(20, 8)).toBe("left");
    expect(deriveDominantFoot(9, 20)).toBe("right");
    expect(deriveDominantFoot(20, 20)).toBe("both");
  });

  it("exposes required club training model fields", () => {
    const club = STARTER_CLUBS[0];

    expect(club.shortName.length).toBeGreaterThan(0);
    expect(club.squadStrength).toBeGreaterThan(0);
    expect(club.budgetLevel).toBeGreaterThan(0);
    expect(club.playStyle.length).toBeGreaterThan(0);
    expect(club.transferPolicy.length).toBeGreaterThan(0);
    expect(club.youthOpportunity).toBeGreaterThan(0);
    expect(club.trainingFacilities.youthDevelopment).toBeGreaterThan(0);
  });
});
