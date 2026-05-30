export interface ClubSeed {
  id: string;
  name: string;
  city: string;
}

export const STARTER_CLUBS: ClubSeed[] = [
  { id: "han-river-fc", name: "한강 FC", city: "서울" },
  { id: "blue-harbor", name: "블루 하버", city: "인천" },
  { id: "daejeon-works", name: "대전 워크스", city: "대전" },
];

export function getClubName(clubId: string): string {
  return STARTER_CLUBS.find((club) => club.id === clubId)?.name ?? "소속 없음";
}
