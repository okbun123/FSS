import { describe, expect, it } from "vitest";
import { FICTIONAL_LEAGUES, K1_LEAGUE_ID } from "../data/fictionalLeagues";
import type { Fixture } from "../domain/types";
import { calculateLeagueTable } from "../game/leagueTable";

describe("calculateLeagueTable", () => {
  it("calculates points and sorting from played fixtures", () => {
    const [home, away] = FICTIONAL_LEAGUES[K1_LEAGUE_ID].clubs;
    const fixtures: Fixture[] = [
      {
        id: "fixture-1",
        leagueId: K1_LEAGUE_ID,
        competitionId: FICTIONAL_LEAGUES[K1_LEAGUE_ID].competitionId,
        seasonNumber: 1,
        round: 1,
        month: 1,
        date: "2027-01-04T00:00:00.000Z",
        weekNumber: 1,
        homeClubId: home.id,
        awayClubId: away.id,
        status: "played",
        result: { homeGoals: 2, awayGoals: 1 },
      },
    ];

    const table = calculateLeagueTable(FICTIONAL_LEAGUES[K1_LEAGUE_ID], fixtures);

    expect(table[0].clubId).toBe(home.id);
    expect(table[0].points).toBe(3);
    expect(table[0].goalDifference).toBe(1);
    expect(table.find((row) => row.clubId === away.id)?.losses).toBe(1);
  });
});
