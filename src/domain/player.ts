import type {
  AttributeFocus,
  Attributes,
  Footedness,
  Personality,
  Player,
  Position,
  SquadRole,
} from "./types";

export type PlayerPosition = Position;
export type PlayerProfile = Player;
export type { Attributes, Personality, Player, Position, SquadRole };

export interface PlayerCreationInput {
  name: string;
  nationality: string;
  clubId: string;
}

export const POSITION_LABELS: Record<Position, string> = {
  ST: "스트라이커",
  LW: "왼쪽 윙어",
  RW: "오른쪽 윙어",
  AM: "공격형 미드필더",
  CM: "중앙 미드필더",
  DM: "수비형 미드필더",
  FB: "풀백",
  CB: "센터백",
};

export const PERSONALITY_LABELS: Record<Personality, string> = {
  diligent: "성실형",
  ambitious: "야망형",
  star: "스타형",
  teamPlayer: "팀 플레이어",
  maverick: "자유분방형",
};

export const SQUAD_ROLE_LABELS: Record<SquadRole, string> = {
  prospect: "유망주",
  rotation: "로테이션",
  regular: "주전 경쟁",
  keyPlayer: "핵심 선수",
};

export const ATTRIBUTE_LABELS: Record<AttributeFocus, string> = {
  "technical.finishing": "결정력",
  "technical.shooting": "슈팅",
  "technical.passing": "패스",
  "technical.dribbling": "드리블",
  "technical.defending": "수비",
  "technical.firstTouch": "퍼스트 터치",
  "technical.crossing": "크로스",
  "technical.tackling": "태클",
  "technical.marking": "마킹",
  "technical.heading": "헤더",
  "physical.pace": "스피드",
  "physical.speed": "속도",
  "physical.acceleration": "가속",
  "physical.stamina": "체력",
  "physical.strength": "힘",
  "physical.agility": "민첩성",
  "mental.decisions": "판단력",
  "mental.composure": "침착성",
  "mental.concentration": "집중력",
  "mental.workRate": "활동량",
  "mental.teamwork": "팀워크",
  "career.professionalism": "프로 의식",
  "career.adaptability": "적응력",
  "career.leadership": "리더십",
  "career.marketability": "스타성",
};

export const ATTRIBUTE_GROUP_LABELS: Record<keyof Attributes, string> = {
  technical: "기술",
  physical: "피지컬",
  mental: "멘탈",
  career: "커리어",
};

export const ATTRIBUTE_GROUP_KEYS: Record<keyof Attributes, string[]> = {
  technical: [
    "finishing",
    "shooting",
    "passing",
    "dribbling",
    "defending",
    "firstTouch",
    "crossing",
    "tackling",
    "marking",
    "heading",
  ],
  physical: ["pace", "speed", "acceleration", "stamina", "strength", "agility"],
  mental: ["decisions", "composure", "concentration", "workRate", "teamwork"],
  career: ["professionalism", "adaptability", "leadership", "marketability"],
};

export function deriveDominantFoot(leftFoot: number, rightFoot: number): Footedness {
  if (leftFoot === 20 && rightFoot === 20) {
    return "both";
  }

  return leftFoot === 20 ? "left" : "right";
}

export function getDominantFootLabel(player: Pick<Player, "leftFoot" | "rightFoot">): string {
  const dominantFoot = deriveDominantFoot(player.leftFoot, player.rightFoot);

  return dominantFoot === "both" ? "양발" : dominantFoot === "left" ? "왼발" : "오른발";
}

export function getPotentialHint(potential: number): string {
  if (potential >= 92) {
    return "리그를 바꿀 수 있는 재능";
  }
  if (potential >= 87) {
    return "국내 최상위권 잠재력";
  }
  if (potential >= 82) {
    return "꾸준히 키우면 주전급";
  }
  return "성장 환경이 중요한 유망주";
}

export function validatePlayerCreationInput(
  input: PlayerCreationInput,
  validClubIds: readonly string[],
): string[] {
  const errors: string[] = [];

  if (input.name.trim().length < 2) {
    errors.push("선수 이름은 2글자 이상 입력해 주세요.");
  }

  if (input.nationality.trim().length < 2) {
    errors.push("국적은 2글자 이상 입력해 주세요.");
  }

  if (!validClubIds.includes(input.clubId)) {
    errors.push("시작 클럽을 다시 선택해 주세요.");
  }

  return errors;
}

export function createStablePlayerId(source: string): string {
  let hash = 0;

  for (const character of source) {
    hash = (hash * 31 + character.charCodeAt(0)) % 1_000_000;
  }

  return `player-${hash.toString().padStart(6, "0")}`;
}
