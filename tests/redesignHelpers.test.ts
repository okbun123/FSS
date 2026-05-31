import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DOMESTIC_CUP_COMPETITION_ID,
  FICTIONAL_LEAGUES,
  K4_LEAGUE_ID,
  getAllClubs,
} from "../src/data/fictionalLeagues";
import { formatStars, getPublicClubStars, toStarRating } from "../src/domain/clubPublicInfo";
import { createInitialDomesticCupFixtures, progressDomesticCupFixtures } from "../src/domain/domesticCup";
import { getVisibleMatchLogEvents } from "../src/domain/matchLog";
import { applySeasonRollover } from "../src/domain/seasonRollover";
import { TEAM_FIT_ROLE_LABELS, calculateTeamFit } from "../src/domain/teamFit";
import { createNewCareer, startNextSeason } from "../src/game/monthlyCareer";
import { generatePlayerRoll } from "../src/game/playerGeneration";
import type { Fixture, MatchEvent, PromotionRelegationStatus } from "../src/domain/types";

function event(input: Partial<MatchEvent> & Pick<MatchEvent, "id" | "type">): MatchEvent {
  return {
    matchId: "match-1",
    minute: 10,
    phase: "FIRST_HALF",
    description: input.type,
    pausesSimulation: true,
    ...input,
  };
}

describe("fixed-screen redesign helpers", () => {
  it("converts exact club internals into public star bands", () => {
    expect(toStarRating(39)).toBe(1);
    expect(toStarRating(40)).toBe(2);
    expect(toStarRating(55)).toBe(3);
    expect(toStarRating(70)).toBe(4);
    expect(toStarRating(85)).toBe(5);

    const stars = getPublicClubStars(getAllClubs()[0]);

    expect(formatStars(stars.reputationStars)).toMatch(/★/);
    expect(Object.values(stars).every((value) => value >= 1 && value <= 5)).toBe(true);
  });

  it("keeps all four playable divisions and creates a clean 64-team cup entry list", () => {
    expect(Object.keys(FICTIONAL_LEAGUES)).toHaveLength(4);
    expect(getAllClubs()).toHaveLength(64);

    const fixtures = createInitialDomesticCupFixtures({
      clubs: getAllClubs(),
      seasonNumber: 1,
      seasonYear: 2027,
    });

    expect(fixtures).toHaveLength(32);
    expect(fixtures.every((fixture) => fixture.competitionId === DOMESTIC_CUP_COMPETITION_ID)).toBe(true);
    expect(fixtures.every((fixture) => fixture.date === "2027-04-07T11:00:00.000Z")).toBe(true);
  });

  it("generates the next domestic cup round only after the current round completes", () => {
    const roundOf64 = createInitialDomesticCupFixtures({
      clubs: getAllClubs(),
      seasonNumber: 1,
      seasonYear: 2027,
    }).map((fixture, index): Fixture => ({
      ...fixture,
      status: "played",
      result: {
        homeGoals: index % 2 === 0 ? 2 : 0,
        awayGoals: index % 2 === 0 ? 0 : 2,
        winnerClubId: index % 2 === 0 ? fixture.homeClubId : fixture.awayClubId,
      },
    }));

    const progressed = progressDomesticCupFixtures({
      fixtures: roundOf64,
      clubsById: Object.fromEntries(getAllClubs().map((club) => [club.id, club])),
      seasonNumber: 1,
      seasonYear: 2027,
    });
    const roundOf32 = progressed.filter((fixture) => fixture.round === 2);

    expect(roundOf32).toHaveLength(16);
    expect(roundOf32.every((fixture) => fixture.date === "2027-05-05T11:00:00.000Z")).toBe(true);
  });

  it("filters match logs without losing major events", () => {
    const visible = getVisibleMatchLogEvents(
      [
        event({ id: "goal", type: "goal", playerId: "other" }),
        event({ id: "yellow-hidden", type: "yellowCard", playerId: "other" }),
        event({ id: "yellow-user", type: "yellowCard", playerId: "player-1" }),
        event({ id: "sub-related", type: "substitution", relatedPlayerId: "player-1" }),
        event({ id: "red", type: "straightRed", playerId: "other" }),
      ],
      "player-1",
    );

    expect(visible.map((item) => item.id)).toEqual(["goal", "yellow-user", "sub-related", "red"]);
  });

  it("projects team role labels through the pure team-fit helper", () => {
    const club = FICTIONAL_LEAGUES[K4_LEAGUE_ID].clubs[0];
    const fit = calculateTeamFit({
      club,
      league: FICTIONAL_LEAGUES[K4_LEAGUE_ID],
      playerOverall: 68,
      selectedPosition: "ST",
    });

    expect(["bench", "rotation", "starter"]).toContain(fit.role);
    expect(Object.values(TEAM_FIT_ROLE_LABELS)).toEqual(["벤치", "로테이션", "주전"]);
  });

  it("replaces relegated D4 clubs with deterministic D5 pool candidates in gameplay mode", () => {
    const relegatedClub = FICTIONAL_LEAGUES[K4_LEAGUE_ID].clubs.at(-1)!;
    const status: PromotionRelegationStatus = {
      isResolved: true,
      promotedClubIds: [],
      relegatedClubIds: [relegatedClub.id],
      note: "test",
    };

    const rolled = applySeasonRollover({
      leagues: FICTIONAL_LEAGUES,
      clubs: Object.fromEntries(getAllClubs().map((club) => [club.id, club])),
      promotionRelegation: status,
      nextSeasonStartYear: 2028,
      leagueMode: "gameplay",
    });

    expect(rolled.relegatedOutClubIds).toContain(relegatedClub.id);
    expect(rolled.archivedNonPlayableClubs.map((club) => club.id)).toContain(relegatedClub.id);
    expect(rolled.promotedPoolClubIds).toHaveLength(1);
    expect(rolled.leagues[K4_LEAGUE_ID].clubs).toHaveLength(18);
    expect(rolled.clubs[relegatedClub.id]).toBeUndefined();
  });

  it("makes the player a free agent when their D4 club drops below playable football", () => {
    const relegatedClub = FICTIONAL_LEAGUES[K4_LEAGUE_ID].clubs.at(-1)!;
    const roll = generatePlayerRoll("d4-free-agent");
    const career = createNewCareer({
      name: "테스트 선수",
      nationality: "대한민국",
      clubId: relegatedClub.id,
      position: roll.recommendations[0].position,
      roll,
    });
    const completedCareer = {
      ...career,
      season: {
        ...career.season,
        isComplete: true,
        promotionRelegation: {
          isResolved: true,
          promotedClubIds: [],
          relegatedClubIds: [relegatedClub.id],
          note: "test",
        },
      },
    };

    const nextSeason = startNextSeason(completedCareer);

    expect(nextSeason.playerContractStatus).toBe("freeAgent");
    expect(nextSeason.transferOffers.length).toBeGreaterThan(0);
    expect(nextSeason.notices.some((notice) => notice.tone === "warning")).toBe(true);
  });

  it("enforces the fixed viewport CSS contract", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/global.css"), "utf8");

    expect(css).toContain("html,\nbody,\n#root");
    expect(css).toContain("height: 100%");
    expect(css).toContain("overflow: hidden");
    expect(css).toContain(".table-scroll");
    expect(css).toContain(".creation-step-layout");
    expect(css).toContain(".match-fixed-grid");
  });
});
