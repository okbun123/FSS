import type {
  Attributes,
  Personality,
  Player,
  PlayStyle,
  Position,
  PreferredFoot,
} from "./types";

export type PlayerPosition = Position;
export type PlayerProfile = Player;
export type { Attributes, Personality, Player, PlayStyle, Position, PreferredFoot };

export interface PlayStyleOption {
  id: PlayStyle;
  label: string;
}

export interface PlayerCreationInput {
  name: string;
  nationality: string;
  age: number;
  preferredFoot: PreferredFoot;
  position: Position;
  playStyle: PlayStyle;
  personality: Personality;
  clubId: string;
}

export const POSITION_LABELS: Record<PlayerPosition, string> = {
  ST: "스트라이커",
  LW: "왼쪽 윙어",
  RW: "오른쪽 윙어",
  AM: "공격형 미드필더",
  CM: "중앙 미드필더",
  DM: "수비형 미드필더",
  FB: "풀백",
  CB: "센터백",
};

export const FOOT_LABELS: Record<PreferredFoot, string> = {
  right: "오른발",
  left: "왼발",
  both: "양발",
};

export const PERSONALITY_LABELS: Record<Personality, string> = {
  diligent: "성실형",
  ambitious: "야망형",
  star: "스타형",
  teamPlayer: "팀플레이형",
  maverick: "반항아형",
};

export const PLAY_STYLE_LABELS: Record<PlayStyle, string> = {
  poacher: "라인 브레이커",
  targetForward: "타깃맨",
  insideForward: "인사이드 포워드",
  wideCreator: "와이드 크리에이터",
  playmaker: "플레이메이커",
  shadowStriker: "섀도 스트라이커",
  boxToBox: "박스 투 박스",
  deepPlaymaker: "후방 플레이메이커",
  ballWinner: "볼 위너",
  holdingMidfielder: "홀딩 미드필더",
  overlapper: "오버래퍼",
  invertedFullback: "인버티드 풀백",
  stopper: "스토퍼",
  ballPlayingDefender: "빌드업 수비수",
};

export const PLAY_STYLES_BY_POSITION: Record<Position, PlayStyleOption[]> = {
  ST: [
    { id: "poacher", label: PLAY_STYLE_LABELS.poacher },
    { id: "targetForward", label: PLAY_STYLE_LABELS.targetForward },
  ],
  LW: [
    { id: "insideForward", label: PLAY_STYLE_LABELS.insideForward },
    { id: "wideCreator", label: PLAY_STYLE_LABELS.wideCreator },
  ],
  RW: [
    { id: "insideForward", label: PLAY_STYLE_LABELS.insideForward },
    { id: "wideCreator", label: PLAY_STYLE_LABELS.wideCreator },
  ],
  AM: [
    { id: "playmaker", label: PLAY_STYLE_LABELS.playmaker },
    { id: "shadowStriker", label: PLAY_STYLE_LABELS.shadowStriker },
  ],
  CM: [
    { id: "boxToBox", label: PLAY_STYLE_LABELS.boxToBox },
    { id: "deepPlaymaker", label: PLAY_STYLE_LABELS.deepPlaymaker },
  ],
  DM: [
    { id: "ballWinner", label: PLAY_STYLE_LABELS.ballWinner },
    { id: "holdingMidfielder", label: PLAY_STYLE_LABELS.holdingMidfielder },
  ],
  FB: [
    { id: "overlapper", label: PLAY_STYLE_LABELS.overlapper },
    { id: "invertedFullback", label: PLAY_STYLE_LABELS.invertedFullback },
  ],
  CB: [
    { id: "stopper", label: PLAY_STYLE_LABELS.stopper },
    { id: "ballPlayingDefender", label: PLAY_STYLE_LABELS.ballPlayingDefender },
  ],
};

const BASE_ATTRIBUTES: Attributes = {
  technical: {
    finishing: 45,
    passing: 48,
    dribbling: 48,
    defending: 45,
    firstTouch: 50,
  },
  physical: {
    pace: 50,
    stamina: 50,
    strength: 48,
    agility: 50,
  },
  mental: {
    decisions: 48,
    composure: 48,
    workRate: 50,
    teamwork: 50,
  },
  career: {
    professionalism: 50,
    adaptability: 48,
    leadership: 42,
    marketability: 40,
  },
};

const POSITION_MODIFIERS: Record<Position, PartialAttributeModifiers> = {
  ST: {
    technical: { finishing: 14, dribbling: 5, firstTouch: 6 },
    physical: { pace: 6, strength: 3 },
    mental: { composure: 7 },
  },
  LW: {
    technical: { finishing: 5, passing: 3, dribbling: 12, firstTouch: 5 },
    physical: { pace: 10, agility: 8 },
    mental: { decisions: 3 },
  },
  RW: {
    technical: { finishing: 5, passing: 3, dribbling: 12, firstTouch: 5 },
    physical: { pace: 10, agility: 8 },
    mental: { decisions: 3 },
  },
  AM: {
    technical: { finishing: 6, passing: 11, dribbling: 8, firstTouch: 8 },
    mental: { decisions: 9, composure: 4 },
  },
  CM: {
    technical: { passing: 12, firstTouch: 7 },
    physical: { stamina: 8 },
    mental: { decisions: 8, workRate: 7, teamwork: 6 },
  },
  DM: {
    technical: { passing: 6, defending: 10, firstTouch: 4 },
    physical: { stamina: 7, strength: 7 },
    mental: { decisions: 7, workRate: 8, teamwork: 5 },
  },
  FB: {
    technical: { passing: 5, dribbling: 4, defending: 8 },
    physical: { pace: 9, stamina: 10, agility: 5 },
    mental: { workRate: 8, teamwork: 4 },
  },
  CB: {
    technical: { passing: 4, defending: 14, firstTouch: 3 },
    physical: { strength: 12, stamina: 4 },
    mental: { decisions: 6, composure: 6, teamwork: 5 },
  },
};

type PartialAttributeModifiers = {
  technical?: Partial<Record<keyof Attributes["technical"], number>>;
  physical?: Partial<Record<keyof Attributes["physical"], number>>;
  mental?: Partial<Record<keyof Attributes["mental"], number>>;
  career?: Partial<Record<keyof Attributes["career"], number>>;
};

const PLAY_STYLE_MODIFIERS: Record<PlayStyle, PartialAttributeModifiers> = {
  poacher: { technical: { finishing: 8, firstTouch: 3 }, mental: { composure: 4 } },
  targetForward: { technical: { firstTouch: 5, finishing: 3 }, physical: { strength: 8 } },
  insideForward: { technical: { dribbling: 7, finishing: 5 }, physical: { agility: 4 } },
  wideCreator: { technical: { passing: 7, dribbling: 5 }, mental: { teamwork: 3 } },
  playmaker: { technical: { passing: 8, firstTouch: 4 }, mental: { decisions: 6 } },
  shadowStriker: { technical: { finishing: 6, dribbling: 4 }, mental: { composure: 4 } },
  boxToBox: { physical: { stamina: 7 }, mental: { workRate: 6, teamwork: 3 } },
  deepPlaymaker: { technical: { passing: 8, firstTouch: 4 }, mental: { decisions: 5 } },
  ballWinner: { technical: { defending: 7 }, physical: { strength: 4 }, mental: { workRate: 5 } },
  holdingMidfielder: { technical: { defending: 5, passing: 4 }, mental: { decisions: 6 } },
  overlapper: { physical: { pace: 5, stamina: 6 }, technical: { dribbling: 3 } },
  invertedFullback: { technical: { passing: 6, firstTouch: 4 }, mental: { decisions: 4 } },
  stopper: { technical: { defending: 8 }, physical: { strength: 5 }, mental: { composure: 3 } },
  ballPlayingDefender: { technical: { passing: 7, firstTouch: 5 }, mental: { decisions: 4 } },
};

const PERSONALITY_MODIFIERS: Record<Personality, PartialAttributeModifiers> = {
  diligent: { mental: { workRate: 6, teamwork: 2 }, career: { professionalism: 8 } },
  ambitious: { mental: { composure: 3 }, career: { leadership: 4, professionalism: 3 } },
  star: { technical: { dribbling: 2 }, career: { marketability: 9 } },
  teamPlayer: { mental: { teamwork: 8, decisions: 2 }, career: { leadership: 2 } },
  maverick: { technical: { dribbling: 4 }, mental: { composure: 3, teamwork: -4 }, career: { adaptability: 5, professionalism: -4 } },
};

function clampAttribute(value: number): number {
  return Math.max(1, Math.min(99, value));
}

function applyModifiers(attributes: Attributes, modifiers: PartialAttributeModifiers): Attributes {
  return {
    technical: {
      finishing: clampAttribute(attributes.technical.finishing + (modifiers.technical?.finishing ?? 0)),
      passing: clampAttribute(attributes.technical.passing + (modifiers.technical?.passing ?? 0)),
      dribbling: clampAttribute(attributes.technical.dribbling + (modifiers.technical?.dribbling ?? 0)),
      defending: clampAttribute(attributes.technical.defending + (modifiers.technical?.defending ?? 0)),
      firstTouch: clampAttribute(attributes.technical.firstTouch + (modifiers.technical?.firstTouch ?? 0)),
    },
    physical: {
      pace: clampAttribute(attributes.physical.pace + (modifiers.physical?.pace ?? 0)),
      stamina: clampAttribute(attributes.physical.stamina + (modifiers.physical?.stamina ?? 0)),
      strength: clampAttribute(attributes.physical.strength + (modifiers.physical?.strength ?? 0)),
      agility: clampAttribute(attributes.physical.agility + (modifiers.physical?.agility ?? 0)),
    },
    mental: {
      decisions: clampAttribute(attributes.mental.decisions + (modifiers.mental?.decisions ?? 0)),
      composure: clampAttribute(attributes.mental.composure + (modifiers.mental?.composure ?? 0)),
      workRate: clampAttribute(attributes.mental.workRate + (modifiers.mental?.workRate ?? 0)),
      teamwork: clampAttribute(attributes.mental.teamwork + (modifiers.mental?.teamwork ?? 0)),
    },
    career: {
      professionalism: clampAttribute(attributes.career.professionalism + (modifiers.career?.professionalism ?? 0)),
      adaptability: clampAttribute(attributes.career.adaptability + (modifiers.career?.adaptability ?? 0)),
      leadership: clampAttribute(attributes.career.leadership + (modifiers.career?.leadership ?? 0)),
      marketability: clampAttribute(attributes.career.marketability + (modifiers.career?.marketability ?? 0)),
    },
  };
}

function getAgeModifier(age: number): PartialAttributeModifiers {
  const extraYears = Math.max(0, age - 16);

  return {
    technical: { firstTouch: extraYears },
    physical: { stamina: extraYears },
    mental: { decisions: extraYears, composure: Math.floor(extraYears / 2) },
  };
}

export function getPlayStylesForPosition(position: Position): PlayStyleOption[] {
  return PLAY_STYLES_BY_POSITION[position];
}

export function isPlayStyleValidForPosition(position: Position, playStyle: PlayStyle): boolean {
  return PLAY_STYLES_BY_POSITION[position].some((option) => option.id === playStyle);
}

export function generateStartingAttributes(input: Pick<PlayerCreationInput, "age" | "position" | "playStyle" | "personality">): Attributes {
  let attributes = BASE_ATTRIBUTES;

  attributes = applyModifiers(attributes, POSITION_MODIFIERS[input.position]);
  attributes = applyModifiers(attributes, PLAY_STYLE_MODIFIERS[input.playStyle]);
  attributes = applyModifiers(attributes, PERSONALITY_MODIFIERS[input.personality]);
  attributes = applyModifiers(attributes, getAgeModifier(input.age));

  return attributes;
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

  if (!Number.isInteger(input.age) || input.age < 16 || input.age > 19) {
    errors.push("나이는 16세부터 19세까지만 선택할 수 있습니다.");
  }

  if (!isPlayStyleValidForPosition(input.position, input.playStyle)) {
    errors.push("선택한 포지션에 맞는 플레이 스타일을 선택해 주세요.");
  }

  if (!validClubIds.includes(input.clubId)) {
    errors.push("시작 클럽을 다시 선택해 주세요.");
  }

  return errors;
}

function createStablePlayerId(input: PlayerCreationInput): string {
  const source = `${input.name}-${input.nationality}-${input.age}-${input.position}-${input.playStyle}-${input.clubId}`;
  let hash = 0;

  for (const character of source) {
    hash = (hash * 31 + character.charCodeAt(0)) % 1_000_000;
  }

  return `player-${hash.toString().padStart(6, "0")}`;
}

function calculatePotential(input: PlayerCreationInput): number {
  const ageBonus = input.age === 16 ? 8 : input.age === 17 ? 5 : input.age === 18 ? 3 : 1;
  const personalityBonus: Record<Personality, number> = {
    diligent: 4,
    ambitious: 5,
    star: 3,
    teamPlayer: 3,
    maverick: 2,
  };

  return Math.min(95, 78 + ageBonus + personalityBonus[input.personality]);
}

export function createPlayerProfile(input: PlayerCreationInput): PlayerProfile {
  const normalizedInput = {
    ...input,
    name: input.name.trim(),
    nationality: input.nationality.trim(),
  };

  return {
    id: createStablePlayerId(normalizedInput),
    name: normalizedInput.name,
    nationality: normalizedInput.nationality,
    age: normalizedInput.age,
    preferredFoot: normalizedInput.preferredFoot,
    position: normalizedInput.position,
    playStyle: normalizedInput.playStyle,
    personality: normalizedInput.personality,
    clubId: normalizedInput.clubId,
    potential: calculatePotential(normalizedInput),
    attributes: generateStartingAttributes(normalizedInput),
  };
}
