import type { Attributes, Player, Position } from "./types";

export type PlayerPosition = Position;
export type PlayerProfile = Player;
export type { Attributes, Player, Position };

export const POSITION_LABELS: Record<PlayerPosition, string> = {
  goalkeeper: "골키퍼",
  defender: "수비수",
  midfielder: "미드필더",
  striker: "공격수",
};

const POSITION_ATTRIBUTE_PRESETS: Record<PlayerPosition, Omit<Attributes, "career">> = {
  goalkeeper: {
    technical: {
      finishing: 36,
      passing: 50,
      dribbling: 38,
      defending: 58,
      firstTouch: 52,
    },
    physical: { pace: 42, stamina: 50, strength: 58, agility: 56 },
    mental: { decisions: 58, composure: 60, workRate: 52, teamwork: 54 },
  },
  defender: {
    technical: {
      finishing: 42,
      passing: 52,
      dribbling: 46,
      defending: 62,
      firstTouch: 50,
    },
    physical: { pace: 54, stamina: 56, strength: 62, agility: 50 },
    mental: { decisions: 56, composure: 55, workRate: 60, teamwork: 58 },
  },
  midfielder: {
    technical: {
      finishing: 50,
      passing: 62,
      dribbling: 58,
      defending: 52,
      firstTouch: 60,
    },
    physical: { pace: 56, stamina: 62, strength: 50, agility: 58 },
    mental: { decisions: 60, composure: 58, workRate: 62, teamwork: 62 },
  },
  striker: {
    technical: {
      finishing: 64,
      passing: 50,
      dribbling: 60,
      defending: 38,
      firstTouch: 58,
    },
    physical: { pace: 62, stamina: 56, strength: 54, agility: 60 },
    mental: { decisions: 56, composure: 60, workRate: 54, teamwork: 50 },
  },
};

export function createDefaultAttributes(position: PlayerPosition): Attributes {
  return {
    ...POSITION_ATTRIBUTE_PRESETS[position],
    career: {
      professionalism: 52,
      adaptability: 50,
      leadership: 44,
      marketability: 40,
    },
  };
}

function createStablePlayerId(name: string, position: PlayerPosition, clubId: string): string {
  const source = `${name}-${position}-${clubId}`;
  let hash = 0;

  for (const character of source) {
    hash = (hash * 31 + character.charCodeAt(0)) % 1_000_000;
  }

  return `player-${hash.toString().padStart(6, "0")}`;
}

export function createPlayerProfile(
  name: string,
  position: PlayerPosition,
  clubId: string,
): PlayerProfile {
  const normalizedName = name.trim() || "이름 없는 선수";

  return {
    id: createStablePlayerId(normalizedName, position, clubId),
    name: normalizedName,
    age: 18,
    position,
    clubId,
    attributes: createDefaultAttributes(position),
  };
}
