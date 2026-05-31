import { describe, expect, it } from "vitest";
import { createMatchEvent } from "../domain/matchEvents";
import {
  advanceMatch,
  createMatchForFixture,
  getAvailableMatchActions,
} from "../domain/matchStateMachine";
import type { Fixture, Match } from "../domain/types";

function createFixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: "fixture-test-1",
    leagueId: "k1_fictional",
    competitionId: "competition-test",
    seasonNumber: 1,
    round: 1,
    month: 3,
    date: "2027-03-06T00:00:00.000Z",
    weekNumber: 1,
    homeClubId: "home-club",
    awayClubId: "away-club",
    status: "scheduled",
    ...overrides,
  };
}

function createMatch(scriptedEvents?: Match["scriptedEvents"], isKnockout = false): Match {
  return createMatchForFixture({
    fixture: createFixture(),
    homeClubName: "Home FC",
    awayClubName: "Away FC",
    isKnockout,
    scriptedEvents,
  });
}

function startFirstHalf(match: Match): Match {
  return advanceMatch(match, "START_FIRST_HALF");
}

function reachSecondHalf(match: Match): Match {
  let workingMatch = startFirstHalf(match);
  workingMatch = advanceMatch(workingMatch, "RUN_TO_HALF_TIME");
  workingMatch = advanceMatch(workingMatch, "CONTINUE");
  return advanceMatch(workingMatch, "START_SECOND_HALF");
}

function reachFullTime(match: Match): Match {
  let workingMatch = reachSecondHalf(match);
  workingMatch = advanceMatch(workingMatch, "RUN_TO_FULL_TIME");
  return workingMatch;
}

describe("matchStateMachine", () => {
  it("starts a match in PRE_MATCH", () => {
    const match = createMatch();

    expect(match.state.phase).toBe("PRE_MATCH");
    expect(match.state.status).toBe("notStarted");
  });

  it("first half button advances correctly", () => {
    const match = createMatch();
    const actions = getAvailableMatchActions(match);
    const started = advanceMatch(match, actions[0].id);

    expect(actions[0].label).toBe("전반전 시작");
    expect(started.state.phase).toBe("FIRST_HALF");
    expect(started.state.minute).toBe(0);
  });

  it("simulation pauses on a goal event", () => {
    const match = startFirstHalf(createMatch());
    const paused = advanceMatch(match, "RUN_TO_HALF_TIME");

    expect(paused.state.isPaused).toBe(true);
    expect(paused.state.pauseReason).toBe("goal");
    expect(paused.state.homeGoals).toBe(1);
    expect(paused.events.at(-1)?.type).toBe("goal");
  });

  it("simulation pauses on a player substitution event", () => {
    let match = startFirstHalf(createMatch());
    match = advanceMatch(match, "RUN_TO_HALF_TIME");
    match = advanceMatch(match, "CONTINUE");
    match = advanceMatch(match, "RUN_TO_HALF_TIME");
    match = advanceMatch(match, "CONTINUE");
    match = advanceMatch(match, "START_SECOND_HALF");

    const paused = advanceMatch(match, "RUN_TO_FULL_TIME");
    const event = paused.events.at(-1);
    const subbedOut = paused.lineups.home.starters.find((player) => player.playerId === event?.playerId);
    const subbedIn = paused.lineups.home.substitutes.find((player) => player.playerId === event?.relatedPlayerId);

    expect(paused.state.isPaused).toBe(true);
    expect(event?.type).toBe("substitutionOut");
    expect(subbedOut?.status).toBe("substituted");
    expect(subbedIn?.status).toBe("onPitch");
  });

  it("red card changes team player status", () => {
    const baseMatch = createMatch([]);
    const player = baseMatch.lineups.away.starters[0];
    const match: Match = {
      ...baseMatch,
      scriptedEvents: [
        createMatchEvent({
          id: "red-card-test",
          matchId: baseMatch.id,
          minute: 12,
          phase: "FIRST_HALF",
          type: "straightRed",
          clubId: baseMatch.awayClubId,
          playerId: player.playerId,
          playerName: player.name,
          description: "퇴장 테스트",
          pausesSimulation: true,
        }),
      ],
    };
    const paused = advanceMatch(startFirstHalf(match), "RUN_TO_HALF_TIME");
    const sentOff = paused.lineups.away.starters.find((candidate) => candidate.playerId === player.playerId);

    expect(paused.state.pauseReason).toBe("straightRed");
    expect(sentOff?.redCard).toBe(true);
    expect(sentOff?.status).toBe("sentOff");
  });

  it("injury marks player as injured", () => {
    const baseMatch = createMatch([]);
    const player = baseMatch.lineups.home.starters[0];
    const match: Match = {
      ...baseMatch,
      scriptedEvents: [
        createMatchEvent({
          id: "injury-test",
          matchId: baseMatch.id,
          minute: 18,
          phase: "FIRST_HALF",
          type: "injury",
          clubId: baseMatch.homeClubId,
          playerId: player.playerId,
          playerName: player.name,
          description: "부상 테스트",
          pausesSimulation: true,
        }),
      ],
    };
    const paused = advanceMatch(startFirstHalf(match), "RUN_TO_HALF_TIME");
    const injured = paused.lineups.home.starters.find((candidate) => candidate.playerId === player.playerId);

    expect(paused.state.pauseReason).toBe("injury");
    expect(injured?.injured).toBe(true);
    expect(injured?.status).toBe("injured");
  });

  it("knockout tied match goes to extra time", () => {
    const fullTime = reachFullTime(createMatch([], true));

    expect(fullTime.state.phase).toBe("FULL_TIME");
    expect(fullTime.state.requiresExtraTime).toBe(true);
    expect(getAvailableMatchActions(advanceMatch(fullTime, "CONTINUE"))[0].id).toBe("START_EXTRA_TIME_FIRST_HALF");
  });

  it("tied after extra time goes to penalty shootout", () => {
    let match = reachFullTime(createMatch([], true));
    match = advanceMatch(match, "CONTINUE");
    match = advanceMatch(match, "START_EXTRA_TIME_FIRST_HALF");
    match = advanceMatch(match, "RUN_TO_EXTRA_TIME_HALF_TIME");
    match = advanceMatch(match, "CONTINUE");
    match = advanceMatch(match, "START_EXTRA_TIME_SECOND_HALF");
    match = advanceMatch(match, "RUN_TO_EXTRA_TIME_FULL_TIME");

    expect(match.state.phase).toBe("EXTRA_TIME_FULL_TIME");
    expect(match.state.requiresPenaltyShootout).toBe(true);
    expect(getAvailableMatchActions(advanceMatch(match, "CONTINUE"))[0].id).toBe("START_PENALTY_SHOOTOUT");
  });

  it("penalty shootout resolves one kicker at a time", () => {
    let match = reachFullTime(createMatch([], true));
    match = advanceMatch(match, "CONTINUE");
    match = advanceMatch(match, "START_EXTRA_TIME_FIRST_HALF");
    match = advanceMatch(match, "RUN_TO_EXTRA_TIME_HALF_TIME");
    match = advanceMatch(match, "CONTINUE");
    match = advanceMatch(match, "START_EXTRA_TIME_SECOND_HALF");
    match = advanceMatch(match, "RUN_TO_EXTRA_TIME_FULL_TIME");
    match = advanceMatch(match, "CONTINUE");
    match = advanceMatch(match, "START_PENALTY_SHOOTOUT");

    const firstKick = advanceMatch(match, "NEXT_PENALTY_KICK");

    expect(firstKick.state.phase).toBe("PENALTY_SHOOTOUT");
    expect(firstKick.state.isPaused).toBe(true);
    expect(firstKick.state.shootout?.kicks).toHaveLength(1);

    match = firstKick;
    for (let step = 0; step < 30 && match.state.phase !== "FINISHED"; step += 1) {
      if (match.state.isPaused) {
        match = advanceMatch(match, "CONTINUE");
      } else {
        match = advanceMatch(match, getAvailableMatchActions(match)[0].id);
      }
    }

    expect(match.state.phase).toBe("FINISHED");
    expect(match.state.winnerClubId).toBeDefined();
    expect(match.state.shootout?.status).toBe("completed");
  });
});
