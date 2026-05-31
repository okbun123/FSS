import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { TeamDetailModal } from "../components/TeamDetailModal";
import { TeamNameLink } from "../components/TeamNameLink";
import { STARTER_CLUBS } from "../data/fictionalLeagues";
import {
  getRecentTeamMatches,
  getTeamDetail,
  MISSING_LAST_SEASON_RESULT_TEXT,
} from "../domain/teamDetails";
import type { CareerState, Club, Fixture } from "../domain/types";
import { createNewCareer } from "../game/monthlyCareer";
import { generatePlayerRoll } from "../game/playerGeneration";

function createCareer(): CareerState {
  const roll = generatePlayerRoll("team-detail-test");

  return createNewCareer({
    name: "팀 상세 테스트",
    nationality: "대한민국",
    clubId: STARTER_CLUBS[0].id,
    position: roll.recommendations[0].position,
    roll,
  });
}

function playedFixture(
  career: CareerState,
  input: {
    id: string;
    round: number;
    date: string;
    homeClubId: string;
    awayClubId: string;
    homeGoals: number;
    awayGoals: number;
  },
): Fixture {
  const club = career.clubs[input.homeClubId] ?? career.clubs[input.awayClubId];

  if (!club) {
    throw new Error("Expected fixture club to exist.");
  }

  return {
    id: input.id,
    leagueId: club.leagueId,
    competitionId: career.leagues[club.leagueId].competitionId,
    seasonNumber: career.season.number,
    round: input.round,
    month: 1,
    date: input.date,
    weekNumber: input.round,
    homeClubId: input.homeClubId,
    awayClubId: input.awayClubId,
    status: "played",
    result: {
      homeGoals: input.homeGoals,
      awayGoals: input.awayGoals,
    },
  };
}

function withRecentFixtures(career: CareerState): CareerState {
  const club = STARTER_CLUBS[0];
  const opponents = career.leagues[club.leagueId].clubs.filter((candidate) => candidate.id !== club.id);
  const fixtures = [
    playedFixture(career, {
      id: "oldest",
      round: 1,
      date: "2027-01-01T00:00:00.000Z",
      homeClubId: club.id,
      awayClubId: opponents[0].id,
      homeGoals: 1,
      awayGoals: 0,
    }),
    playedFixture(career, {
      id: "draw-away",
      round: 2,
      date: "2027-01-02T00:00:00.000Z",
      homeClubId: opponents[1].id,
      awayClubId: club.id,
      homeGoals: 2,
      awayGoals: 2,
    }),
    playedFixture(career, {
      id: "loss-home",
      round: 3,
      date: "2027-01-03T00:00:00.000Z",
      homeClubId: club.id,
      awayClubId: opponents[2].id,
      homeGoals: 0,
      awayGoals: 1,
    }),
    playedFixture(career, {
      id: "win-away",
      round: 4,
      date: "2027-01-04T00:00:00.000Z",
      homeClubId: opponents[3].id,
      awayClubId: club.id,
      homeGoals: 0,
      awayGoals: 3,
    }),
    playedFixture(career, {
      id: "draw-home",
      round: 5,
      date: "2027-01-05T00:00:00.000Z",
      homeClubId: club.id,
      awayClubId: opponents[4].id,
      homeGoals: 1,
      awayGoals: 1,
    }),
    playedFixture(career, {
      id: "newest-win",
      round: 6,
      date: "2027-01-06T00:00:00.000Z",
      homeClubId: club.id,
      awayClubId: opponents[5].id,
      homeGoals: 4,
      awayGoals: 2,
    }),
  ];

  return {
    ...career,
    fixtures,
    season: {
      ...career.season,
      fixtures,
    },
  };
}

function textFrom(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(textFrom).join("");
  }

  if (isValidElement(node)) {
    return textFrom((node.props as { children?: ReactNode }).children);
  }

  return "";
}

describe("team detail popup data", () => {
  it("clicking a team name link calls the opener with the club id", () => {
    const club = STARTER_CLUBS[0];
    let openedClubId: string | null = null;
    const element = TeamNameLink({
      clubId: club.id,
      children: club.name,
      onOpenTeam: (clubId) => {
        openedClubId = clubId;
      },
    }) as ReactElement<{ onClick: () => void; type: string; "aria-label": string }>;

    expect(element.type).toBe("button");
    expect(element.props.type).toBe("button");
    expect(element.props["aria-label"]).toContain("팀 정보 열기");

    element.props.onClick();

    expect(openedClubId).toBe(club.id);
  });

  it("modal shows the correct league", () => {
    const career = createCareer();
    const club = STARTER_CLUBS[0];
    const element = TeamDetailModal({
      career,
      clubId: club.id,
      onClose: () => undefined,
      onOpenTeam: () => undefined,
    });

    expect(textFrom(element)).toContain(career.leagues[club.leagueId].name);
  });

  it("computes recent five form from played fixtures", () => {
    const career = withRecentFixtures(createCareer());
    const club = STARTER_CLUBS[0];
    const recent = getRecentTeamMatches(career, club.id);

    expect(recent.map((match) => match.fixtureId)).toEqual([
      "newest-win",
      "draw-home",
      "win-away",
      "loss-home",
      "draw-away",
    ]);
    expect(recent.map((match) => match.outcome)).toEqual(["W", "D", "W", "L", "D"]);
    expect(recent.map((match) => match.score)).toEqual(["4-2", "1-1", "3-0", "0-1", "2-2"]);
  });

  it("uses a safe Korean fallback when last season data is missing", () => {
    const career = createCareer();
    const club = STARTER_CLUBS[0];
    const detail = getTeamDetail(career, club.id);

    expect(detail?.lastSeasonResult.fallback).toBe(MISSING_LAST_SEASON_RESULT_TEXT);
  });

  it("reads last season result from ClubSeasonRecord", () => {
    const career = createCareer();
    const club = career.clubs[STARTER_CLUBS[0].id] as Club;
    const recordedClub: Club = {
      ...club,
      seasonRecords: [
        {
          seasonNumber: 1,
          leagueId: club.leagueId,
          leaguePosition: 2,
          points: 68,
          goalsFor: 54,
          goalsAgainst: 31,
          reputation: club.reputation,
          budgetLevel: club.budgetLevel,
          youthOpportunity: club.youthOpportunity,
          squadStrength: club.squadStrength,
          leagueMovement: "stayed",
          cupResult: "4강",
        },
      ],
    };
    const careerWithRecord: CareerState = {
      ...career,
      season: {
        ...career.season,
        number: 2,
      },
      clubs: {
        ...career.clubs,
        [recordedClub.id]: recordedClub,
      },
    };
    const detail = getTeamDetail(careerWithRecord, recordedClub.id);

    expect(detail?.lastSeasonResult.finalLeaguePosition).toBe(2);
    expect(detail?.lastSeasonResult.movement).toBe("stayed");
    expect(detail?.lastSeasonResult.cupResult).toBe("4강");
  });
});
