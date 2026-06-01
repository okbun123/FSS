import { describe, expect, it } from "vitest";
import {
  DOMESTIC_CUP_COMPETITION_ID,
  FICTIONAL_LEAGUES,
  K4_LEAGUE_ID,
  createFictionalCompetitions,
  getAllClubs,
} from "../data/fictionalLeagues";
import { createMatchForFixture, fastForwardMatchToFinish } from "../domain/matchStateMachine";
import {
  createInitialDomesticCupFixtures,
  ensureCupWinner,
  getDomesticCupRoundLabel,
  progressDomesticCupFixtures,
} from "../domain/domesticCup";
import type { Fixture } from "../domain/types";
import { advanceWeek, resolveActiveMatch } from "../game/monthlyCareer";
import { generatePlayerRoll } from "../game/playerGeneration";
import { createNewCareer } from "../game/monthlyCareer";
import { getClubFixtureRows } from "../screens/CareerDashboardScreen";

function playedWithHomeWinner(fixture: Fixture): Fixture {
  return {
    ...fixture,
    status: "played",
    result: {
      homeGoals: 2,
      awayGoals: 0,
      winnerClubId: fixture.homeClubId,
      decidedBy: "normalTime",
    },
  };
}

function weekStart(dateIso: string): string {
  const date = new Date(dateIso);
  const daysFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return date.toISOString();
}

describe("domestic FA cup", () => {
  it("generates exact-dated preliminary cup fixtures", () => {
    const fixtures = createInitialDomesticCupFixtures({
      clubs: getAllClubs(),
      seasonNumber: 1,
      seasonYear: 2027,
    });

    expect(fixtures).toHaveLength(5);
    expect(fixtures.every((fixture) => fixture.competitionId === DOMESTIC_CUP_COMPETITION_ID)).toBe(true);
    expect(fixtures.every((fixture) => fixture.round === 0)).toBe(true);
    expect(fixtures.every((fixture) => fixture.date === "2027-03-17T11:00:00.000Z")).toBe(true);
    expect(getDomesticCupRoundLabel(0)).toBe("예선");
  });

  it("advances knockout winners and stages higher divisions into later rounds", () => {
    const clubsById = Object.fromEntries(getAllClubs().map((club) => [club.id, club]));
    const preliminary = createInitialDomesticCupFixtures({
      clubs: getAllClubs(),
      seasonNumber: 1,
      seasonYear: 2027,
    }).map(playedWithHomeWinner);

    const firstRound = progressDomesticCupFixtures({
      fixtures: preliminary,
      clubsById,
      seasonNumber: 1,
      seasonYear: 2027,
    });
    const secondRound = progressDomesticCupFixtures({
      fixtures: firstRound.map((fixture) => (fixture.round === 1 ? playedWithHomeWinner(fixture) : fixture)),
      clubsById,
      seasonNumber: 1,
      seasonYear: 2027,
    });
    const thirdRound = progressDomesticCupFixtures({
      fixtures: secondRound.map((fixture) => (fixture.round === 2 ? playedWithHomeWinner(fixture) : fixture)),
      clubsById,
      seasonNumber: 1,
      seasonYear: 2027,
    });

    expect(firstRound.filter((fixture) => fixture.round === 1)).toHaveLength(19);
    expect(secondRound.filter((fixture) => fixture.round === 2)).toHaveLength(18);
    expect(thirdRound.filter((fixture) => fixture.round === 3)).toHaveLength(16);
    expect(
      thirdRound.some(
        (fixture) =>
          fixture.round === 3 &&
          [fixture.homeClubId, fixture.awayClubId].some((clubId) => clubsById[clubId]?.leagueId === "div1"),
      ),
    ).toBe(true);
  });

  it("resolves tied cup matches through extra time or penalties", () => {
    const fixture = createInitialDomesticCupFixtures({
      clubs: getAllClubs(),
      seasonNumber: 1,
      seasonYear: 2027,
      includeNonPlayablePool: false,
    })[0];
    const result = ensureCupWinner(
      fixture,
      { homeGoals: 1, awayGoals: 1 },
      () => 0.9,
    );
    const match = fastForwardMatchToFinish(
      createMatchForFixture({
        fixture,
        isKnockout: true,
        scriptedEvents: [],
      }),
    );

    expect(result.decidedBy).toBe("penalties");
    expect(result.winnerClubId).toBeDefined();
    expect(match.state.phase).toBe("FINISHED");
    expect(match.state.winnerClubId).toBeDefined();
    expect(match.state.shootout?.status).toBe("completed");
  });

  it("shows cup fixtures in the club schedule and records player cup appearances", () => {
    const club = FICTIONAL_LEAGUES[K4_LEAGUE_ID].clubs[0];
    const roll = generatePlayerRoll("domestic-cup-player-appearance");
    const career = createNewCareer({
      name: "컵 테스트 선수",
      nationality: "대한민국",
      clubId: club.id,
      position: roll.recommendations[0].position,
      roll,
    });
    const clubsById = Object.fromEntries(getAllClubs().map((candidate) => [candidate.id, candidate]));
    const preliminary = createInitialDomesticCupFixtures({
      clubs: getAllClubs(),
      seasonNumber: career.season.number,
      seasonYear: career.season.year,
    }).map(playedWithHomeWinner);
    const firstRound = progressDomesticCupFixtures({
      fixtures: preliminary,
      clubsById,
      seasonNumber: career.season.number,
      seasonYear: career.season.year,
    });
    const cupFixture = firstRound.find(
      (fixture) => fixture.round === 1 && (fixture.homeClubId === club.id || fixture.awayClubId === club.id),
    );

    expect(cupFixture).toBeDefined();

    const fixtures = [cupFixture!];
    const currentDate = weekStart(cupFixture!.date);
    const careerWithCup = {
      ...career,
      currentDate,
      currentWeekStartDate: currentDate,
      fixtures,
      competitions: createFictionalCompetitions(career.season.number, fixtures),
      season: {
        ...career.season,
        currentMonth: new Date(cupFixture!.date).getUTCMonth() + 1,
        fixtures,
      },
    };
    const scheduleRows = getClubFixtureRows(careerWithCup);
    const opened = advanceWeek(careerWithCup);
    const resolved = resolveActiveMatch(opened);

    expect(scheduleRows.some((row) => row.includes("전국 FA컵"))).toBe(true);
    expect(opened.activeMatchId).toBeDefined();
    expect(
      resolved.playerAppearanceLogs.some((log) => log.competitionId === DOMESTIC_CUP_COMPETITION_ID),
    ).toBe(true);
  });
});
