import type { Player, Position, PositionRecommendation } from "./types";

export type PositionFitAttribute =
  | "finishing"
  | "shooting"
  | "composure"
  | "strength"
  | "heading"
  | "speed"
  | "firstTouch"
  | "acceleration"
  | "dribbling"
  | "crossing"
  | "passing"
  | "footSuitability"
  | "decisions"
  | "agility"
  | "stamina"
  | "tackling"
  | "concentration"
  | "marking";

export const POSITION_FIT_WEIGHTS = {
  ST: {
    finishing: 0.25,
    shooting: 0.2,
    composure: 0.15,
    strength: 0.1,
    heading: 0.1,
    speed: 0.1,
    firstTouch: 0.1,
  },
  LW: {
    speed: 0.2,
    acceleration: 0.15,
    dribbling: 0.2,
    crossing: 0.15,
    firstTouch: 0.1,
    passing: 0.1,
    footSuitability: 0.1,
  },
  RW: {
    speed: 0.2,
    acceleration: 0.15,
    dribbling: 0.2,
    crossing: 0.15,
    firstTouch: 0.1,
    passing: 0.1,
    footSuitability: 0.1,
  },
  AM: {
    passing: 0.2,
    dribbling: 0.15,
    firstTouch: 0.15,
    decisions: 0.2,
    composure: 0.15,
    shooting: 0.1,
    agility: 0.05,
  },
  CM: {
    passing: 0.2,
    stamina: 0.15,
    decisions: 0.2,
    firstTouch: 0.1,
    tackling: 0.1,
    concentration: 0.1,
    composure: 0.15,
  },
  DM: {
    tackling: 0.2,
    marking: 0.15,
    strength: 0.15,
    stamina: 0.15,
    concentration: 0.15,
    passing: 0.1,
    decisions: 0.1,
  },
  FB: {
    speed: 0.15,
    stamina: 0.2,
    crossing: 0.15,
    tackling: 0.15,
    marking: 0.15,
    acceleration: 0.1,
    passing: 0.1,
  },
  CB: {
    marking: 0.2,
    tackling: 0.2,
    heading: 0.15,
    strength: 0.15,
    concentration: 0.15,
    composure: 0.1,
    passing: 0.05,
  },
} as const satisfies Record<Position, Partial<Record<PositionFitAttribute, number>>>;

const POSITIONS: Position[] = ["ST", "LW", "RW", "AM", "CM", "DM", "FB", "CB"];

const POSITION_LABELS_KO: Record<Position, string> = {
  ST: "스트라이커",
  LW: "왼쪽 윙어",
  RW: "오른쪽 윙어",
  AM: "공격형 미드필더",
  CM: "중앙 미드필더",
  DM: "수비형 미드필더",
  FB: "풀백",
  CB: "센터백",
};

const ATTRIBUTE_LABELS_KO: Record<PositionFitAttribute, string> = {
  finishing: "마무리",
  shooting: "슈팅",
  composure: "침착성",
  strength: "피지컬",
  heading: "헤더",
  speed: "스피드",
  firstTouch: "첫 터치",
  acceleration: "가속",
  dribbling: "드리블",
  crossing: "크로스",
  passing: "패스",
  footSuitability: "발 활용도",
  decisions: "판단력",
  agility: "민첩성",
  stamina: "체력",
  tackling: "태클",
  concentration: "집중력",
  marking: "마킹",
};

interface WeightedAttributeScore {
  attribute: PositionFitAttribute;
  label: string;
  value: number;
  weight: number;
  weightedScore: number;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function average(...values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function readRating(value: number | undefined, fallback: number): number {
  return clamp(typeof value === "number" ? value : fallback);
}

function getFootSuitability(player: Player, position: Position): number {
  const naturalSideFoot = position === "LW" ? player.leftFoot : player.rightFoot;
  const oppositeFoot = position === "LW" ? player.rightFoot : player.leftFoot;
  const weakFoot = Math.min(player.leftFoot, player.rightFoot);
  const bestWingFoot = Math.max(naturalSideFoot, oppositeFoot * 0.88);
  const weakFootBonus = (weakFoot / 20) * 10;

  return clamp(bestWingFoot * 4.45 + weakFootBonus);
}

function getPositionAttributeValue(
  player: Player,
  position: Position,
  attribute: PositionFitAttribute,
): number {
  const { technical, physical, mental } = player.attributes;

  switch (attribute) {
    case "finishing":
      return readRating(technical.finishing, 0);
    case "shooting":
      return readRating(technical.shooting, average(technical.finishing, mental.composure));
    case "composure":
      return readRating(mental.composure, 0);
    case "strength":
      return readRating(physical.strength, 0);
    case "heading":
      return readRating(technical.heading, average(physical.strength, technical.defending));
    case "speed":
      return readRating(physical.speed, physical.pace);
    case "firstTouch":
      return readRating(technical.firstTouch, 0);
    case "acceleration":
      return readRating(physical.acceleration, average(physical.pace, physical.agility));
    case "dribbling":
      return readRating(technical.dribbling, 0);
    case "crossing":
      return readRating(technical.crossing, technical.passing);
    case "passing":
      return readRating(technical.passing, 0);
    case "footSuitability":
      return getFootSuitability(player, position);
    case "decisions":
      return readRating(mental.decisions, 0);
    case "agility":
      return readRating(physical.agility, 0);
    case "stamina":
      return readRating(physical.stamina, 0);
    case "tackling":
      return readRating(technical.tackling, technical.defending);
    case "concentration":
      return readRating(mental.concentration, average(mental.decisions, mental.composure, mental.workRate));
    case "marking":
      return readRating(technical.marking, technical.defending);
  }
}

function getWeightedAttributeScores(player: Player, position: Position): WeightedAttributeScore[] {
  return (Object.entries(POSITION_FIT_WEIGHTS[position]) as Array<[PositionFitAttribute, number]>).map(([attribute, weight]) => {
    const value = getPositionAttributeValue(player, position, attribute);

    return {
      attribute,
      label: ATTRIBUTE_LABELS_KO[attribute],
      value,
      weight,
      weightedScore: value * weight,
    };
  });
}

function getTopStrengths(scores: WeightedAttributeScore[]): WeightedAttributeScore[] {
  return [...scores]
    .sort((left, right) => right.value - left.value || right.weight - left.weight)
    .slice(0, 2);
}

function getWeakestAttribute(scores: WeightedAttributeScore[]): WeightedAttributeScore {
  return [...scores].sort((left, right) => left.value - right.value || right.weight - left.weight)[0];
}

function createExplanation(
  position: Position,
  strengths: WeightedAttributeScore[],
  weakest: WeightedAttributeScore,
): string {
  const strengthText = strengths
    .map((strength) => `${strength.label} ${Math.round(strength.value)}`)
    .join(", ");

  return `${POSITION_LABELS_KO[position]} 적합도는 ${strengthText}가 강점이라 높게 평가됩니다. 관련 항목 중 ${weakest.label} ${Math.round(weakest.value)}이 가장 낮아, 이 부분을 보완하면 더 안정적인 포지션이 됩니다.`;
}

export function calculatePositionRecommendations(player: Player): PositionRecommendation[] {
  const scored = POSITIONS.map((position) => {
    const scores = getWeightedAttributeScores(player, position);
    const fitScore = Math.round(
      clamp(scores.reduce((total, score) => total + score.weightedScore, 0)),
    );
    const strengths = getTopStrengths(scores);
    const weakest = getWeakestAttribute(scores);
    const reason = createExplanation(position, strengths, weakest);

    return {
      position,
      fitScore,
      isRecommended: false,
      reason,
      keyStrengths: strengths.map((strength) => strength.label),
      keyWeaknesses: [weakest.label],
      overall: fitScore,
      explanationKo: reason,
    };
  }).sort(
    (left, right) =>
      right.fitScore - left.fitScore ||
      left.position.localeCompare(right.position),
  );

  return scored.map((recommendation, index) => ({
    ...recommendation,
    isRecommended: index < 3,
  }));
}
