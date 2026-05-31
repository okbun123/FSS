import type {
  Match,
  MatchEvent,
  MatchEventType,
  MatchPhase,
  MatchPlayer,
  MatchPlayerStatus,
} from "./types";

export const MATCH_PHASE_LABELS: Record<MatchPhase, string> = {
  PRE_MATCH: "경기 전",
  FIRST_HALF: "전반전",
  HALF_TIME: "하프타임",
  SECOND_HALF: "후반전",
  FULL_TIME: "정규시간 종료",
  EXTRA_TIME_FIRST_HALF: "연장 전반",
  EXTRA_TIME_HALF_TIME: "연장 하프타임",
  EXTRA_TIME_SECOND_HALF: "연장 후반",
  EXTRA_TIME_FULL_TIME: "연장 종료",
  PENALTY_SHOOTOUT: "승부차기",
  FINISHED: "경기 종료",
};

export const MATCH_EVENT_TYPE_LABELS: Record<MatchEventType, string> = {
  kickoff: "킥오프",
  goal: "득점",
  ownGoal: "자책골",
  assist: "도움",
  substitution: "교체",
  substitutionIn: "교체 투입",
  substitutionOut: "교체 아웃",
  yellowCard: "경고",
  secondYellowRed: "경고 누적 퇴장",
  straightRed: "퇴장",
  redCard: "퇴장",
  injury: "부상",
  penaltyAwarded: "페널티킥 선언",
  penaltyScored: "페널티킥 득점",
  penaltyMissed: "페널티킥 실축",
  halfTime: "하프타임",
  extraTimeStart: "연장전 시작",
  extraTimeEnd: "연장전 종료",
  shootoutKick: "승부차기",
  fullTime: "경기 종료",
};

export const MATCH_PLAYER_STATUS_LABELS: Record<MatchPlayerStatus, string> = {
  available: "대기",
  onPitch: "출전 중",
  substituted: "교체됨",
  sentOff: "퇴장",
  injured: "부상",
};

export function getMatchPhaseLabel(phase: MatchPhase): string {
  return MATCH_PHASE_LABELS[phase] ?? phase;
}

export function getMatchEventTypeLabel(type: MatchEventType): string {
  return MATCH_EVENT_TYPE_LABELS[type] ?? type;
}

export function getMatchPlayerStatus(player: MatchPlayer): MatchPlayerStatus {
  if (player.status) {
    return player.status;
  }

  if (player.redCard) {
    return "sentOff";
  }

  if (player.injured) {
    return "injured";
  }

  return "available";
}

export function getMatchPlayerStatusLabel(player: MatchPlayer): string {
  return MATCH_PLAYER_STATUS_LABELS[getMatchPlayerStatus(player)];
}

export function getPausedMatchEvent(match: Match): MatchEvent | undefined {
  if (!match.state.isPaused) {
    return undefined;
  }

  if (match.state.lastEventId) {
    return match.events.find((event) => event.id === match.state.lastEventId);
  }

  return [...match.events].reverse().find((event) => event.pausesSimulation);
}

export function findMatchPlayer(match: Match, playerId?: string): MatchPlayer | undefined {
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

export function createMatchEvent(
  input: Omit<MatchEvent, "id" | "description" | "pausesSimulation"> & {
    id?: string;
    description?: string;
    pausesSimulation?: boolean;
  },
): MatchEvent {
  const playerText = input.playerName ? ` - ${input.playerName}` : "";

  return {
    ...input,
    id: input.id ?? `${input.matchId}-${input.phase}-${input.minute}-${input.type}`,
    description:
      input.description ??
      `${input.minute}분 ${getMatchEventTypeLabel(input.type)}${playerText}`,
    pausesSimulation: input.pausesSimulation ?? true,
  };
}
