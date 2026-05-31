import { createMatchEvent } from "./matchEvents";
import type {
  Match,
  MatchEvent,
  MatchPlayer,
  PenaltyShootoutKick,
  PenaltyShootoutState,
} from "./types";

const FIRST_TEN_KICK_OUTCOMES = [
  true,
  true,
  true,
  false,
  true,
  true,
  false,
  true,
  true,
  false,
];

function createShootoutState(): PenaltyShootoutState {
  return {
    status: "inProgress",
    currentKickIndex: 0,
    homeGoals: 0,
    awayGoals: 0,
    kicks: [],
  };
}

function getKicker(match: Match, team: "home" | "away", kickIndex: number): MatchPlayer | undefined {
  const lineup = match.lineups[team];
  const eligiblePlayers = [...lineup.starters, ...lineup.substitutes].filter(
    (player) => player.status !== "sentOff" && player.status !== "injured" && !player.redCard && !player.injured,
  );

  return eligiblePlayers[kickIndex % Math.max(eligiblePlayers.length, 1)];
}

function getKickOutcome(kickIndex: number): "scored" | "missed" {
  const plannedOutcome = FIRST_TEN_KICK_OUTCOMES[kickIndex];

  if (typeof plannedOutcome === "boolean") {
    return plannedOutcome ? "scored" : "missed";
  }

  return kickIndex % 4 === 1 ? "missed" : "scored";
}

function getShootoutWinner(
  state: PenaltyShootoutState,
  homeClubId: string,
  awayClubId: string,
): string | undefined {
  const homeTaken = state.kicks.filter((kick) => kick.team === "home").length;
  const awayTaken = state.kicks.filter((kick) => kick.team === "away").length;
  const homeRemaining = Math.max(0, 5 - homeTaken);
  const awayRemaining = Math.max(0, 5 - awayTaken);

  if (homeTaken <= 5 || awayTaken <= 5) {
    if (state.homeGoals > state.awayGoals + awayRemaining) {
      return homeClubId;
    }

    if (state.awayGoals > state.homeGoals + homeRemaining) {
      return awayClubId;
    }
  }

  if (homeTaken >= 5 && awayTaken >= 5 && homeTaken === awayTaken && state.homeGoals !== state.awayGoals) {
    return state.homeGoals > state.awayGoals ? homeClubId : awayClubId;
  }

  return undefined;
}

function createShootoutEvent(match: Match, kick: PenaltyShootoutKick): MatchEvent {
  const teamName = kick.team === "home" ? "홈" : "원정";
  const outcomeText = kick.outcome === "scored" ? "성공" : "실축";

  return createMatchEvent({
    id: `${match.id}-shootout-${kick.kickIndex}`,
    matchId: match.id,
    minute: 120,
    phase: "PENALTY_SHOOTOUT",
    type: "shootoutKick",
    clubId: kick.clubId,
    playerId: kick.playerId,
    playerName: kick.playerName,
    teamName,
    shootoutScoreAfter: kick.scoreAfter,
    shootoutKickResult: kick.outcome,
    description: `${teamName} ${kick.round}번째 키커 ${kick.playerName ?? "선수"}가 승부차기를 ${outcomeText}했습니다.`,
    pausesSimulation: true,
  });
}

export function startPenaltyShootout(match: Match): Match {
  return {
    ...match,
    state: {
      ...match.state,
      status: "inProgress",
      phase: "PENALTY_SHOOTOUT",
      minute: 120,
      isPaused: false,
      pauseReason: undefined,
      lastEventId: undefined,
      requiresPenaltyShootout: true,
      shootout: match.state.shootout ?? createShootoutState(),
    },
  };
}

export function advancePenaltyShootoutKick(match: Match): Match {
  const shootout = match.state.shootout ?? createShootoutState();

  if (shootout.status === "completed") {
    return match;
  }

  const kickIndex = shootout.currentKickIndex;
  const team = kickIndex % 2 === 0 ? "home" : "away";
  const clubId = team === "home" ? match.homeClubId : match.awayClubId;
  const kicker = getKicker(match, team, Math.floor(kickIndex / 2));
  const outcome = getKickOutcome(kickIndex);
  const scoreAfter = {
    homeGoals: shootout.homeGoals + (team === "home" && outcome === "scored" ? 1 : 0),
    awayGoals: shootout.awayGoals + (team === "away" && outcome === "scored" ? 1 : 0),
  };
  const kick: PenaltyShootoutKick = {
    id: `${match.id}-shootout-kick-${kickIndex}`,
    round: Math.floor(kickIndex / 2) + 1,
    kickIndex,
    team,
    clubId,
    playerId: kicker?.playerId,
    playerName: kicker?.name,
    outcome,
    scoreAfter,
  };
  const nextShootout: PenaltyShootoutState = {
    ...shootout,
    currentKickIndex: kickIndex + 1,
    homeGoals: scoreAfter.homeGoals,
    awayGoals: scoreAfter.awayGoals,
    kicks: [...shootout.kicks, kick],
  };
  const winnerClubId = getShootoutWinner(nextShootout, match.homeClubId, match.awayClubId);
  const finalKick = winnerClubId ? { ...kick, decisive: true } : kick;
  const event = createShootoutEvent(match, finalKick);

  return {
    ...match,
    events: [...match.events, event],
    state: {
      ...match.state,
      status: winnerClubId ? "completed" : "paused",
      phase: winnerClubId ? "FINISHED" : "PENALTY_SHOOTOUT",
      minute: 120,
      isPaused: true,
      pauseReason: "shootoutKick",
      lastEventId: event.id,
      winnerClubId,
      requiresPenaltyShootout: true,
      shootout: {
        ...nextShootout,
        kicks: [...shootout.kicks, finalKick],
        status: winnerClubId ? "completed" : "inProgress",
        winnerClubId,
      },
    },
  };
}
