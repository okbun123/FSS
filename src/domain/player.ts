export type PlayerPosition = "striker" | "midfielder" | "defender" | "goalkeeper";

export interface PlayerProfile {
  id: string;
  name: string;
  age: number;
  position: PlayerPosition;
  clubId: string;
}

export const POSITION_LABELS: Record<PlayerPosition, string> = {
  striker: "공격수",
  midfielder: "미드필더",
  defender: "수비수",
  goalkeeper: "골키퍼",
};

export function createPlayerProfile(
  name: string,
  position: PlayerPosition,
  clubId: string,
): PlayerProfile {
  const normalizedName = name.trim() || "이름 없는 선수";

  return {
    id: `player-${Date.now()}`,
    name: normalizedName,
    age: 18,
    position,
    clubId,
  };
}
