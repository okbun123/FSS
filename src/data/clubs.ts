import type { Club, League } from "../domain/types";

export type ClubSeed = Club;

export const CLUBS: Club[] = [
  {
    id: "lumina-city",
    name: "루미나 시티",
    city: "루미나",
    strength: 72,
    reputation: 68,
  },
  {
    id: "hanbit-rovers",
    name: "한빛 로버스",
    city: "한빛",
    strength: 66,
    reputation: 61,
  },
  {
    id: "coral-harbor",
    name: "코럴 하버",
    city: "노을만",
    strength: 63,
    reputation: 58,
  },
  {
    id: "solar-works",
    name: "솔라 워크스",
    city: "솔라",
    strength: 69,
    reputation: 64,
  },
  {
    id: "northgate-athletic",
    name: "노스게이트 애슬레틱",
    city: "북문",
    strength: 60,
    reputation: 57,
  },
  {
    id: "galaxy-united",
    name: "갤럭시 유나이티드",
    city: "은하",
    strength: 70,
    reputation: 67,
  },
  {
    id: "greenhill-fc",
    name: "그린힐 FC",
    city: "푸른언덕",
    strength: 58,
    reputation: 54,
  },
  {
    id: "dawn-castle",
    name: "돈 캐슬",
    city: "새벽성",
    strength: 62,
    reputation: 56,
  },
];

export const STARTER_CLUBS = CLUBS.filter((club) => club.reputation <= 58);

export const DEFAULT_LEAGUE: League = {
  id: "fictional-premier-league",
  name: "퓨처 스타 리그",
  country: "가상 축구 연맹",
  clubs: CLUBS,
  seasonWeeks: 14,
};

export function getClubName(clubId: string): string {
  return CLUBS.find((club) => club.id === clubId)?.name ?? "소속 없음";
}
