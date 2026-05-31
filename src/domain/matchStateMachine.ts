import { createMatchEvent } from "./matchEvents";
import { advancePenaltyShootoutKick, startPenaltyShootout } from "./penaltyShootout";
import type {
  Fixture,
  Match,
  MatchEvent,
  MatchEventType,
  MatchLineup,
  MatchPhase,
  MatchPlayer,
  Player,
  Position,
} from "./types";

export type MatchAction =
  | "START_FIRST_HALF"
  | "RUN_TO_HALF_TIME"
  | "START_SECOND_HALF"
  | "RUN_TO_FULL_TIME"
  | "START_EXTRA_TIME_FIRST_HALF"
  | "RUN_TO_EXTRA_TIME_HALF_TIME"
  | "START_EXTRA_TIME_SECOND_HALF"
  | "RUN_TO_EXTRA_TIME_FULL_TIME"
  | "START_PENALTY_SHOOTOUT"
  | "NEXT_PENALTY_KICK"
  | "CONTINUE";

export interface MatchControlAction {
  id: MatchAction;
  label: string;
}

export interface CreateMatchForFixtureInput {
  fixture: Fixture;
  homeClubName?: string;
  awayClubName?: string;
  player?: Player;
  isKnockout?: boolean;
  aggregateScore?: {
    homeGoals: number;
    awayGoals: number;
  };
  scriptedEvents?: MatchEvent[];
}

const MATCH_ACTION_LABELS: Record<MatchAction, string> = {
  START_FIRST_HALF: "전반전 시작",
  RUN_TO_HALF_TIME: "하프타임까지 진행",
  START_SECOND_HALF: "후반전 시작",
  RUN_TO_FULL_TIME: "경기 종료까지 진행",
  START_EXTRA_TIME_FIRST_HALF: "연장 전반 시작",
  RUN_TO_EXTRA_TIME_HALF_TIME: "연장 하프타임까지 진행",
  START_EXTRA_TIME_SECOND_HALF: "연장 후반 시작",
  RUN_TO_EXTRA_TIME_FULL_TIME: "연장 종료까지 진행",
  START_PENALTY_SHOOTOUT: "승부차기 시작",
  NEXT_PENALTY_KICK: "다음 키커 진행",
  CONTINUE: "계속 진행",
};

const READABLE_MATCH_ACTION_LABELS: Record<MatchAction, string> = {
  START_FIRST_HALF: "전반 시작",
  RUN_TO_HALF_TIME: "하프타임까지 진행",
  START_SECOND_HALF: "후반 시작",
  RUN_TO_FULL_TIME: "경기 종료까지 진행",
  START_EXTRA_TIME_FIRST_HALF: "연장 전반 시작",
  RUN_TO_EXTRA_TIME_HALF_TIME: "연장 하프타임까지 진행",
  START_EXTRA_TIME_SECOND_HALF: "연장 후반 시작",
  RUN_TO_EXTRA_TIME_FULL_TIME: "연장 종료까지 진행",
  START_PENALTY_SHOOTOUT: "승부차기 시작",
  NEXT_PENALTY_KICK: "다음 키커 진행",
  CONTINUE: "계속 진행",
};

const PHASE_ORDER: Record<MatchPhase, number> = {
  PRE_MATCH: 0,
  FIRST_HALF: 1,
  HALF_TIME: 2,
  SECOND_HALF: 3,
  FULL_TIME: 4,
  EXTRA_TIME_FIRST_HALF: 5,
  EXTRA_TIME_HALF_TIME: 6,
  EXTRA_TIME_SECOND_HALF: 7,
  EXTRA_TIME_FULL_TIME: 8,
  PENALTY_SHOOTOUT: 9,
  FINISHED: 10,
};

const STARTER_POSITIONS: Position[] = ["FB", "CB", "CB", "FB", "DM", "CM", "CM", "AM", "LW", "RW", "ST"];
const BENCH_POSITIONS: Position[] = ["CB", "FB", "DM", "CM", "AM", "RW", "ST"];

function isCreateInput(input: Fixture | CreateMatchForFixtureInput): input is CreateMatchForFixtureInput {
  return "fixture" in input;
}

function getFixture(input: Fixture | CreateMatchForFixtureInput): Fixture {
  return isCreateInput(input) ? input.fixture : input;
}

function createMatchPlayer(input: {
  playerId: string;
  name: string;
  position: Position;
  squadNumber: number;
  condition?: number;
  status: MatchPlayer["status"];
  isUserPlayer?: boolean;
}): MatchPlayer {
  return {
    playerId: input.playerId,
    name: input.name,
    position: input.position,
    squadNumber: input.squadNumber,
    isUserPlayer: input.isUserPlayer,
    condition: input.condition ?? 82,
    rating: undefined,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCard: false,
    injured: false,
    status: input.status,
    minutesPlayed: 0,
  };
}

function getPlayerStarterIndex(position: Position): number {
  const exactIndex = STARTER_POSITIONS.findIndex((starterPosition) => starterPosition === position);

  return exactIndex >= 0 ? exactIndex : 10;
}

function createLineup(
  clubId: string,
  side: "home" | "away",
  clubName: string,
  userPlayer?: Player,
): MatchLineup {
  const label = clubName.split(" ")[0] ?? clubId;
  const starters = STARTER_POSITIONS.map((position, index) =>
    createMatchPlayer({
      playerId: `${clubId}-${side}-starter-${index + 1}`,
      name: `${label} ${index + 1}`,
      position,
      squadNumber: index + 2,
      status: "onPitch",
    }),
  );
  const substitutes = BENCH_POSITIONS.map((position, index) =>
    createMatchPlayer({
      playerId: `${clubId}-${side}-sub-${index + 1}`,
      name: `${label} 후보 ${index + 1}`,
      position,
      squadNumber: index + 20,
      status: "available",
    }),
  );

  if (userPlayer?.clubId === clubId) {
    const starterIndex = getPlayerStarterIndex(userPlayer.selectedPosition);
    starters[starterIndex] = createMatchPlayer({
      playerId: userPlayer.id,
      name: userPlayer.name,
      position: userPlayer.selectedPosition,
      squadNumber: userPlayer.age,
      condition: userPlayer.condition,
      status: "onPitch",
      isUserPlayer: true,
    });
  }

  return {
    clubId,
    formation: "4-2-3-1",
    starters,
    substitutes,
  };
}

export function createMatchForFixture(input: Fixture | CreateMatchForFixtureInput): Match {
  const fixture = getFixture(input);
  const createInput = isCreateInput(input) ? input : undefined;
  const matchId = fixture.matchId ?? `match-${fixture.id}`;

  return {
    id: matchId,
    fixtureId: fixture.id,
    competitionId: fixture.competitionId,
    date: fixture.date,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    isKnockout: createInput?.isKnockout,
    state: {
      status: "notStarted",
      phase: "PRE_MATCH",
      minute: 0,
      homeGoals: 0,
      awayGoals: 0,
      isPaused: false,
      nextEventIndex: 0,
      aggregateHomeGoalsBeforeMatch: createInput?.aggregateScore?.homeGoals,
      aggregateAwayGoalsBeforeMatch: createInput?.aggregateScore?.awayGoals,
    },
    lineups: {
      home: createLineup(
        fixture.homeClubId,
        "home",
        createInput?.homeClubName ?? "홈",
        createInput?.player,
      ),
      away: createLineup(
        fixture.awayClubId,
        "away",
        createInput?.awayClubName ?? "원정",
        createInput?.player,
      ),
    },
    events: [],
    scriptedEvents: createInput?.scriptedEvents,
  };
}

function playerName(player?: MatchPlayer): string | undefined {
  return player?.name;
}

function createDefaultMatchEventPlan(match: Match): MatchEvent[] {
  const homeScorer = match.lineups.home.starters[10];
  const homeCreator = match.lineups.home.starters[7];
  const homeSubbedOut = match.lineups.home.starters[8];
  const homeSubbedIn = match.lineups.home.substitutes[5] ?? match.lineups.home.substitutes[0];
  const awayDefender = match.lineups.away.starters[2];
  const homeInjured = match.lineups.home.starters[5];

  return [
    createMatchEvent({
      id: `${match.id}-event-goal-23`,
      matchId: match.id,
      minute: 23,
      phase: "FIRST_HALF",
      type: "goal",
      clubId: match.homeClubId,
      playerId: homeScorer?.playerId,
      relatedPlayerId: homeCreator?.playerId,
      playerName: playerName(homeScorer),
      relatedPlayerName: playerName(homeCreator),
      teamName: "홈",
      description: `${homeScorer?.name ?? "홈 공격수"}가 침착하게 마무리했습니다.`,
      pausesSimulation: true,
    }),
    createMatchEvent({
      id: `${match.id}-event-substitution-62`,
      matchId: match.id,
      minute: 62,
      phase: "SECOND_HALF",
      type: "substitutionOut",
      clubId: match.homeClubId,
      playerId: homeSubbedOut?.playerId,
      relatedPlayerId: homeSubbedIn?.playerId,
      playerName: playerName(homeSubbedOut),
      relatedPlayerName: playerName(homeSubbedIn),
      teamName: "홈",
      description: `${homeSubbedOut?.name ?? "선수"}가 나오고 ${homeSubbedIn?.name ?? "후보 선수"}가 투입됩니다.`,
      pausesSimulation: true,
    }),
    createMatchEvent({
      id: `${match.id}-event-red-74`,
      matchId: match.id,
      minute: 74,
      phase: "SECOND_HALF",
      type: "straightRed",
      clubId: match.awayClubId,
      playerId: awayDefender?.playerId,
      playerName: playerName(awayDefender),
      teamName: "원정",
      description: `${awayDefender?.name ?? "원정 수비수"}가 거친 태클로 바로 퇴장당합니다.`,
      pausesSimulation: true,
    }),
    createMatchEvent({
      id: `${match.id}-event-injury-83`,
      matchId: match.id,
      minute: 83,
      phase: "SECOND_HALF",
      type: "injury",
      clubId: match.homeClubId,
      playerId: homeInjured?.playerId,
      playerName: playerName(homeInjured),
      teamName: "홈",
      description: `${homeInjured?.name ?? "홈 선수"}가 통증을 호소하며 치료가 필요합니다.`,
      pausesSimulation: true,
    }),
  ];
}

function getMatchEventPlan(match: Match): MatchEvent[] {
  return [...(match.scriptedEvents ?? createDefaultMatchEventPlan(match))].sort(
    (left, right) =>
      PHASE_ORDER[left.phase] - PHASE_ORDER[right.phase] ||
      left.minute - right.minute ||
      left.id.localeCompare(right.id),
  );
}

function updateMatchPlayer(
  match: Match,
  playerId: string | undefined,
  updater: (player: MatchPlayer) => MatchPlayer,
): Match {
  if (!playerId) {
    return match;
  }

  const updateLineup = (lineup: MatchLineup): MatchLineup => ({
    ...lineup,
    starters: lineup.starters.map((player) => (player.playerId === playerId ? updater(player) : player)),
    substitutes: lineup.substitutes.map((player) => (player.playerId === playerId ? updater(player) : player)),
  });

  return {
    ...match,
    lineups: {
      home: updateLineup(match.lineups.home),
      away: updateLineup(match.lineups.away),
    },
  };
}

function findPlayer(match: Match, playerId?: string): MatchPlayer | undefined {
  if (!playerId) {
    return undefined;
  }

  return [
    ...match.lineups.home.starters,
    ...match.lineups.home.substitutes,
    ...match.lineups.away.starters,
    ...match.lineups.away.substitutes,
  ].find((player) => player.playerId === playerId);
}

function getScoreAfterEvent(match: Match, event: MatchEvent) {
  const homeScored = event.clubId === match.homeClubId;
  const awayScored = event.clubId === match.awayClubId;
  const scoringEvent = event.type === "goal" || event.type === "ownGoal" || event.type === "penaltyScored";

  return {
    homeGoals: match.state.homeGoals + (scoringEvent && homeScored ? 1 : 0),
    awayGoals: match.state.awayGoals + (scoringEvent && awayScored ? 1 : 0),
  };
}

function applyLineupEvent(match: Match, event: MatchEvent): Match {
  if (event.type === "goal" || event.type === "ownGoal" || event.type === "penaltyScored") {
    let updated = updateMatchPlayer(match, event.playerId, (player) => ({
      ...player,
      goals: player.goals + 1,
    }));

    if (event.relatedPlayerId) {
      updated = updateMatchPlayer(updated, event.relatedPlayerId, (player) => ({
        ...player,
        assists: player.assists + 1,
      }));
    }

    return updated;
  }

  if (event.type === "assist") {
    return updateMatchPlayer(match, event.playerId, (player) => ({
      ...player,
      assists: player.assists + 1,
    }));
  }

  if (event.type === "substitutionOut" || event.type === "substitution") {
    let updated = updateMatchPlayer(match, event.playerId, (player) => ({
      ...player,
      minutesPlayed: Math.max(player.minutesPlayed, event.minute),
      status: "substituted",
    }));

    updated = updateMatchPlayer(updated, event.relatedPlayerId, (player) => ({
      ...player,
      status: "onPitch",
    }));

    return updated;
  }

  if (event.type === "substitutionIn") {
    let updated = updateMatchPlayer(match, event.playerId, (player) => ({
      ...player,
      status: "onPitch",
    }));

    updated = updateMatchPlayer(updated, event.relatedPlayerId, (player) => ({
      ...player,
      minutesPlayed: Math.max(player.minutesPlayed, event.minute),
      status: "substituted",
    }));

    return updated;
  }

  if (event.type === "yellowCard") {
    return updateMatchPlayer(match, event.playerId, (player) => ({
      ...player,
      yellowCards: player.yellowCards + 1,
    }));
  }

  if (event.type === "secondYellowRed") {
    return updateMatchPlayer(match, event.playerId, (player) => ({
      ...player,
      yellowCards: Math.max(2, player.yellowCards + 1),
      redCard: true,
      status: "sentOff",
    }));
  }

  if (event.type === "straightRed" || event.type === "redCard") {
    return updateMatchPlayer(match, event.playerId, (player) => ({
      ...player,
      redCard: true,
      status: "sentOff",
    }));
  }

  if (event.type === "injury") {
    return updateMatchPlayer(match, event.playerId, (player) => ({
      ...player,
      injured: true,
      status: "injured",
    }));
  }

  return match;
}

function applyMatchEvent(match: Match, event: MatchEvent, nextEventIndex = match.state.nextEventIndex): Match {
  const matchAfterLineup = applyLineupEvent(match, event);
  const scoreAfter = event.scoreAfter ?? getScoreAfterEvent(matchAfterLineup, event);
  const player = findPlayer(matchAfterLineup, event.playerId);
  const relatedPlayer = findPlayer(matchAfterLineup, event.relatedPlayerId);
  const emittedEvent: MatchEvent = {
    ...event,
    playerName: event.playerName ?? player?.name,
    relatedPlayerName: event.relatedPlayerName ?? relatedPlayer?.name,
    scoreAfter,
  };

  return {
    ...matchAfterLineup,
    events: [...matchAfterLineup.events, emittedEvent],
    state: {
      ...matchAfterLineup.state,
      status: event.pausesSimulation ? "paused" : "inProgress",
      phase: event.phase,
      minute: event.minute,
      homeGoals: scoreAfter.homeGoals,
      awayGoals: scoreAfter.awayGoals,
      isPaused: event.pausesSimulation,
      pauseReason: event.pausesSimulation ? event.type : undefined,
      lastEventId: event.pausesSimulation ? emittedEvent.id : undefined,
      nextEventIndex,
    },
  };
}

function createPhaseBoundaryEvent(input: {
  match: Match;
  phase: MatchPhase;
  minute: number;
  type: MatchEventType;
  description: string;
}): MatchEvent {
  return createMatchEvent({
    id: `${input.match.id}-${input.phase.toLowerCase()}-${input.type}`,
    matchId: input.match.id,
    minute: input.minute,
    phase: input.phase,
    type: input.type,
    description: input.description,
    pausesSimulation: true,
  });
}

function getNextPlannedEvent(match: Match, endMinute: number): { event: MatchEvent; index: number } | undefined {
  const plan = getMatchEventPlan(match);

  for (let index = match.state.nextEventIndex; index < plan.length; index += 1) {
    const event = plan[index];

    if (event.phase !== match.state.phase) {
      continue;
    }

    if (event.minute > match.state.minute && event.minute <= endMinute) {
      return { event, index };
    }
  }

  return undefined;
}

function simulateToPhaseEnd(
  match: Match,
  endMinute: number,
  boundaryPhase: MatchPhase,
  boundaryType: MatchEventType,
  description: string,
): Match {
  if (match.state.isPaused) {
    return match;
  }

  const plannedEvent = getNextPlannedEvent(match, endMinute);

  if (plannedEvent) {
    return applyMatchEvent(match, plannedEvent.event, plannedEvent.index + 1);
  }

  const ended = applyMatchEvent(
    match,
    createPhaseBoundaryEvent({
      match,
      phase: boundaryPhase,
      minute: endMinute,
      type: boundaryType,
      description,
    }),
  );

  if (boundaryPhase === "FULL_TIME") {
    const aggregateHomeGoals = ended.state.homeGoals + (ended.state.aggregateHomeGoalsBeforeMatch ?? 0);
    const aggregateAwayGoals = ended.state.awayGoals + (ended.state.aggregateAwayGoalsBeforeMatch ?? 0);
    const tied = aggregateHomeGoals === aggregateAwayGoals;
    const requiresExtraTime = Boolean(match.isKnockout && tied);

    return {
      ...ended,
      state: {
        ...ended.state,
        requiresExtraTime,
        winnerClubId:
          requiresExtraTime || tied
            ? undefined
            : aggregateHomeGoals > aggregateAwayGoals
              ? ended.homeClubId
              : ended.awayClubId,
      },
    };
  }

  if (boundaryPhase === "EXTRA_TIME_FULL_TIME") {
    const aggregateHomeGoals = ended.state.homeGoals + (ended.state.aggregateHomeGoalsBeforeMatch ?? 0);
    const aggregateAwayGoals = ended.state.awayGoals + (ended.state.aggregateAwayGoalsBeforeMatch ?? 0);
    const tied = aggregateHomeGoals === aggregateAwayGoals;

    return {
      ...ended,
      state: {
        ...ended.state,
        requiresPenaltyShootout: tied,
        winnerClubId: tied
          ? undefined
          : aggregateHomeGoals > aggregateAwayGoals
            ? ended.homeClubId
            : ended.awayClubId,
      },
    };
  }

  return ended;
}

function startPhase(match: Match, phase: MatchPhase, minute: number, event?: MatchEvent): Match {
  const nextMatch = event ? applyMatchEvent(match, event, match.state.nextEventIndex) : match;

  return {
    ...nextMatch,
    state: {
      ...nextMatch.state,
      status: "inProgress",
      phase,
      minute,
      isPaused: false,
      pauseReason: undefined,
      lastEventId: undefined,
    },
  };
}

function continueMatch(match: Match): Match {
  const clearedPause = {
    ...match,
    state: {
      ...match.state,
      status: match.state.phase === "FINISHED" ? "completed" as const : "inProgress" as const,
      isPaused: false,
      pauseReason: undefined,
      lastEventId: undefined,
    },
  };

  if (clearedPause.state.phase === "FULL_TIME" && !clearedPause.state.requiresExtraTime) {
    const aggregateHomeGoals =
      clearedPause.state.homeGoals + (clearedPause.state.aggregateHomeGoalsBeforeMatch ?? 0);
    const aggregateAwayGoals =
      clearedPause.state.awayGoals + (clearedPause.state.aggregateAwayGoalsBeforeMatch ?? 0);

    return {
      ...clearedPause,
      state: {
        ...clearedPause.state,
        status: "completed",
        phase: "FINISHED",
        winnerClubId:
          clearedPause.state.winnerClubId ??
          (aggregateHomeGoals === aggregateAwayGoals
            ? undefined
            : aggregateHomeGoals > aggregateAwayGoals
              ? clearedPause.homeClubId
              : clearedPause.awayClubId),
      },
    };
  }

  if (clearedPause.state.phase === "EXTRA_TIME_FULL_TIME" && !clearedPause.state.requiresPenaltyShootout) {
    const aggregateHomeGoals =
      clearedPause.state.homeGoals + (clearedPause.state.aggregateHomeGoalsBeforeMatch ?? 0);
    const aggregateAwayGoals =
      clearedPause.state.awayGoals + (clearedPause.state.aggregateAwayGoalsBeforeMatch ?? 0);

    return {
      ...clearedPause,
      state: {
        ...clearedPause.state,
        status: "completed",
        phase: "FINISHED",
        winnerClubId:
          clearedPause.state.winnerClubId ??
          (aggregateHomeGoals > aggregateAwayGoals
            ? clearedPause.homeClubId
            : clearedPause.awayClubId),
      },
    };
  }

  return clearedPause;
}

export function advanceMatch(match: Match, action: MatchAction): Match {
  if (action !== "CONTINUE" && match.state.isPaused) {
    return match;
  }

  switch (action) {
    case "START_FIRST_HALF":
      if (match.state.phase !== "PRE_MATCH") {
        return match;
      }

      return startPhase(
        match,
        "FIRST_HALF",
        0,
        createMatchEvent({
          id: `${match.id}-kickoff`,
          matchId: match.id,
          minute: 0,
          phase: "FIRST_HALF",
          type: "kickoff",
          description: "전반전이 시작됩니다.",
          pausesSimulation: false,
        }),
      );

    case "RUN_TO_HALF_TIME":
      if (match.state.phase !== "FIRST_HALF") {
        return match;
      }

      return simulateToPhaseEnd(match, 45, "HALF_TIME", "halfTime", "하프타임입니다.");

    case "START_SECOND_HALF":
      if (match.state.phase !== "HALF_TIME") {
        return match;
      }

      return startPhase(match, "SECOND_HALF", 45);

    case "RUN_TO_FULL_TIME":
      if (match.state.phase !== "SECOND_HALF") {
        return match;
      }

      return simulateToPhaseEnd(match, 90, "FULL_TIME", "fullTime", "정규시간이 종료되었습니다.");

    case "START_EXTRA_TIME_FIRST_HALF":
      if (match.state.phase !== "FULL_TIME" || !match.state.requiresExtraTime) {
        return match;
      }

      return startPhase(
        match,
        "EXTRA_TIME_FIRST_HALF",
        90,
        createMatchEvent({
          id: `${match.id}-extra-time-start`,
          matchId: match.id,
          minute: 90,
          phase: "EXTRA_TIME_FIRST_HALF",
          type: "extraTimeStart",
          description: "연장 전반전이 시작됩니다.",
          pausesSimulation: false,
        }),
      );

    case "RUN_TO_EXTRA_TIME_HALF_TIME":
      if (match.state.phase !== "EXTRA_TIME_FIRST_HALF") {
        return match;
      }

      return simulateToPhaseEnd(match, 105, "EXTRA_TIME_HALF_TIME", "halfTime", "연장 하프타임입니다.");

    case "START_EXTRA_TIME_SECOND_HALF":
      if (match.state.phase !== "EXTRA_TIME_HALF_TIME") {
        return match;
      }

      return startPhase(match, "EXTRA_TIME_SECOND_HALF", 105);

    case "RUN_TO_EXTRA_TIME_FULL_TIME":
      if (match.state.phase !== "EXTRA_TIME_SECOND_HALF") {
        return match;
      }

      return simulateToPhaseEnd(match, 120, "EXTRA_TIME_FULL_TIME", "extraTimeEnd", "연장전이 종료되었습니다.");

    case "START_PENALTY_SHOOTOUT":
      if (match.state.phase !== "EXTRA_TIME_FULL_TIME" || !match.state.requiresPenaltyShootout) {
        return match;
      }

      return startPenaltyShootout(match);

    case "NEXT_PENALTY_KICK":
      if (match.state.phase !== "PENALTY_SHOOTOUT") {
        return match;
      }

      return advancePenaltyShootoutKick(match);

    case "CONTINUE":
      return continueMatch(match);

    default:
      return match;
  }
}

export function getAvailableMatchActions(match: Match): MatchControlAction[] {
  if (match.state.isPaused) {
    return [{ id: "CONTINUE", label: READABLE_MATCH_ACTION_LABELS.CONTINUE }];
  }

  const action = (() => {
    switch (match.state.phase) {
      case "PRE_MATCH":
        return "START_FIRST_HALF";
      case "FIRST_HALF":
        return "RUN_TO_HALF_TIME";
      case "HALF_TIME":
        return "START_SECOND_HALF";
      case "SECOND_HALF":
        return "RUN_TO_FULL_TIME";
      case "FULL_TIME":
        return match.state.requiresExtraTime ? "START_EXTRA_TIME_FIRST_HALF" : "CONTINUE";
      case "EXTRA_TIME_FIRST_HALF":
        return "RUN_TO_EXTRA_TIME_HALF_TIME";
      case "EXTRA_TIME_HALF_TIME":
        return "START_EXTRA_TIME_SECOND_HALF";
      case "EXTRA_TIME_SECOND_HALF":
        return "RUN_TO_EXTRA_TIME_FULL_TIME";
      case "EXTRA_TIME_FULL_TIME":
        return match.state.requiresPenaltyShootout ? "START_PENALTY_SHOOTOUT" : "CONTINUE";
      case "PENALTY_SHOOTOUT":
        return "NEXT_PENALTY_KICK";
      case "FINISHED":
        return "CONTINUE";
      default:
        return undefined;
    }
  })();

  return action ? [{ id: action, label: READABLE_MATCH_ACTION_LABELS[action] }] : [];
}

export function isMatchReadyToFinalize(match: Match): boolean {
  return match.state.phase === "FINISHED" && !match.state.isPaused;
}

export function fastForwardMatchToFinish(match: Match): Match {
  let workingMatch = match;

  for (let step = 0; step < 80 && !isMatchReadyToFinalize(workingMatch); step += 1) {
    const action = getAvailableMatchActions(workingMatch)[0]?.id ?? "CONTINUE";
    workingMatch = advanceMatch(workingMatch, action);
  }

  return workingMatch;
}
