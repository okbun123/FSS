import { describe, expect, it } from "vitest";
import { CLUBS } from "../data/clubs";
import { generateSeasonSchedule } from "../game/schedule";

describe("generateSeasonSchedule", () => {
  it("creates a 14-week double round-robin schedule for 8 clubs", () => {
    const schedule = generateSeasonSchedule(CLUBS);

    expect(schedule).toHaveLength(56);
    expect(new Set(schedule.map((match) => match.week)).size).toBe(14);
  });

  it("schedules every club exactly once per week", () => {
    const schedule = generateSeasonSchedule(CLUBS);

    for (let week = 1; week <= 14; week += 1) {
      const weekMatches = schedule.filter((match) => match.week === week);
      const participatingClubIds = weekMatches.flatMap((match) => [
        match.homeClubId,
        match.awayClubId,
      ]);

      expect(weekMatches).toHaveLength(4);
      expect(new Set(participatingClubIds).size).toBe(CLUBS.length);
    }
  });

  it("gives every pair one home and one away fixture", () => {
    const schedule = generateSeasonSchedule(CLUBS);
    const pairCounts = new Map<string, { homeAway: Set<string>; total: number }>();

    for (const match of schedule) {
      const pairKey = [match.homeClubId, match.awayClubId].sort().join(":");
      const existing = pairCounts.get(pairKey) ?? { homeAway: new Set<string>(), total: 0 };

      existing.total += 1;
      existing.homeAway.add(`${match.homeClubId}->${match.awayClubId}`);
      pairCounts.set(pairKey, existing);
    }

    expect(pairCounts.size).toBe(28);

    for (const pairing of pairCounts.values()) {
      expect(pairing.total).toBe(2);
      expect(pairing.homeAway.size).toBe(2);
    }
  });
});
