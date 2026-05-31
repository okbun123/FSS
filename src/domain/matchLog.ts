import type { MatchEvent } from "./types";

const ALWAYS_VISIBLE_TYPES = new Set<MatchEvent["type"]>([
  "goal",
  "ownGoal",
  "penaltyScored",
  "straightRed",
  "secondYellowRed",
  "redCard",
]);

const PLAYER_ONLY_TYPES = new Set<MatchEvent["type"]>([
  "yellowCard",
  "substitution",
  "substitutionIn",
  "substitutionOut",
  "injury",
]);

function involvesPlayer(event: MatchEvent, playerId?: string): boolean {
  return Boolean(playerId && (event.playerId === playerId || event.relatedPlayerId === playerId));
}

export function isVisibleMatchLogEvent(event: MatchEvent, playerId?: string): boolean {
  if (ALWAYS_VISIBLE_TYPES.has(event.type)) {
    return true;
  }

  if (PLAYER_ONLY_TYPES.has(event.type)) {
    return involvesPlayer(event, playerId);
  }

  return true;
}

export function getVisibleMatchLogEvents(events: readonly MatchEvent[], playerId?: string): MatchEvent[] {
  return events.filter((event) => isVisibleMatchLogEvent(event, playerId));
}
