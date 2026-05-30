import { describe, expect, it } from "vitest";
import { STARTER_CLUBS } from "../data/clubs";
import type { CareerState } from "../domain/types";
import { createNewCareer } from "../game/career";
import {
  createSeasonSummary,
  isSeasonComplete,
  startNextSeason,
} from "../game/season";

function createCareer() {
  return createNewCareer({
    name: "시즌테스터",
    nationality: "대한민국",
    age: 18,
    preferredFoot: "right",
    position: "ST",
    playStyle: "poacher",
    personality: "diligent",
    clubId: STARTER_CLUBS[0].id,
  });
}

function completePlayerSeason(career: CareerState): CareerState {
  return {
    ...career,
    player: {
      ...career.player,
      attributes: {
        ...career.player.attributes,
        technical: {
          ...career.player.attributes.technical,
          finishing: career.player.attributes.technical.finishing + 2,
          passing: career.player.attributes.technical.passing + 1,
        },
      },
    },
    season: {
      ...career.season,
      matches: career.season.matches.map((match) =>
        match.homeClubId === career.player.clubId || match.awayClubId === career.player.clubId
          ? {
              ...match,
              status: "played" as const,
              result: {
                homeGoals: match.homeClubId === career.player.clubId ? 2 : 1,
                awayGoals: match.awayClubId === career.player.clubId ? 2 : 1,
              },
            }
          : match,
      ),
    },
    seasonStats: {
      appearances: 14,
      minutesPlayed: 1120,
      goals: 6,
      assists: 4,
      shots: 32,
      keyPasses: 18,
      tackles: 9,
      turnovers: 11,
      averageRating: 6.84,
      keyMomentsWon: 17,
    },
    coachTrust: career.coachTrust + 8,
    fanSupport: career.fanSupport + 12,
    reputation: career.reputation + 5,
  };
}

describe("season completion", () => {
  it("detects when every player season match has been played", () => {
    const career = createCareer();
    const completedCareer = completePlayerSeason(career);

    expect(isSeasonComplete(career)).toBe(false);
    expect(isSeasonComplete(completedCareer)).toBe(true);
  });

  it("creates a season summary with ranking, stat changes, and attribute growth", () => {
    const completedCareer = completePlayerSeason(createCareer());
    const summary = createSeasonSummary(completedCareer);

    expect(summary.leaguePosition).toBeGreaterThanOrEqual(1);
    expect(summary.leaguePosition).toBeLessThanOrEqual(8);
    expect(summary.appearances).toBe(14);
    expect(summary.goals).toBe(6);
    expect(summary.assists).toBe(4);
    expect(summary.averageRating).toBe(6.84);
    expect(summary.coachTrustChange).toBe(8);
    expect(summary.fanSupportChange).toBe(12);
    expect(summary.reputationChange).toBe(5);
    expect(summary.attributeGrowthSummary[0]).toMatchObject({
      attribute: "technical.finishing",
      amount: 2,
    });
  });
});

describe("startNextSeason", () => {
  it("rolls the career into a new season and stores history", () => {
    const completedCareer = completePlayerSeason(createCareer());
    const nextCareer = startNextSeason(completedCareer, {
      completedAt: "2026-06-01T00:00:00.000Z",
    });

    expect(nextCareer.player.age).toBe(completedCareer.player.age + 1);
    expect(nextCareer.currentWeek).toBe(1);
    expect(nextCareer.season.number).toBe(2);
    expect(nextCareer.season.matches).toHaveLength(56);
    expect(nextCareer.season.matches.every((match) => match.status === "scheduled")).toBe(true);
    expect(nextCareer.seasonStats.appearances).toBe(0);
    expect(nextCareer.seasonStats.goals).toBe(0);
    expect(nextCareer.developmentLog).toHaveLength(0);
    expect(nextCareer.careerHistory).toHaveLength(1);
    expect(nextCareer.careerHistory[0]).toMatchObject({
      seasonNumber: 1,
      goals: 6,
      assists: 4,
      completedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(nextCareer.seasonBaseline.seasonNumber).toBe(2);
    expect(
      nextCareer.league.clubs.some(
        (club, index) => club.strength !== completedCareer.league.clubs[index].strength,
      ),
    ).toBe(true);
  });

  it("does not roll over before the season is complete", () => {
    expect(() => startNextSeason(createCareer())).toThrow(
      "Cannot start the next season before all player matches are complete.",
    );
  });
});
