import type {
  AttributeFocus,
  Attributes,
  CareerState,
  DevelopmentReport,
  DevelopmentSource,
  Player,
  PlayerMatchStats,
  WeeklyActionType,
} from "../domain/types";

export const ATTRIBUTE_LABELS: Record<AttributeFocus, string> = {
  "technical.finishing": "결정력",
  "technical.passing": "패스",
  "technical.dribbling": "드리블",
  "technical.defending": "수비",
  "technical.firstTouch": "퍼스트 터치",
  "physical.pace": "스피드",
  "physical.stamina": "체력",
  "physical.strength": "힘",
  "physical.agility": "민첩성",
  "mental.decisions": "판단력",
  "mental.composure": "침착성",
  "mental.workRate": "활동량",
  "mental.teamwork": "팀워크",
};

export interface GrowthAmountInput {
  age: number;
  potential: number;
  professionalism: number;
  fatigue: number;
  condition: number;
  currentValue: number;
  baseRate: number;
}

interface GrowthTarget {
  attribute: AttributeFocus;
  baseRate: number;
}

interface WeeklyGrowthInput {
  actionType: WeeklyActionType;
  attributeFocus?: AttributeFocus;
  createdAt?: string;
}

interface MatchGrowthInput {
  stats: PlayerMatchStats;
  rating: number;
  createdAt?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundGrowth(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundAttribute(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getAttributeValue(attributes: Attributes, focus: AttributeFocus): number {
  const [group, key] = focus.split(".") as [
    keyof Attributes,
    keyof Attributes[keyof Attributes],
  ];
  const attributeGroup = attributes[group] as unknown as Record<string, number>;

  return attributeGroup[key as string];
}

function setAttributeValue(player: Player, focus: AttributeFocus, value: number): Player {
  const [group, key] = focus.split(".") as [
    keyof Attributes,
    keyof Attributes[keyof Attributes],
  ];

  return {
    ...player,
    attributes: {
      ...player.attributes,
      [group]: {
        ...player.attributes[group],
        [key]: roundAttribute(clamp(value, 1, 100)),
      },
    },
  };
}

export function calculateGrowthAmount(input: GrowthAmountInput): number {
  const ageFactor = input.age <= 16 ? 1.28 : input.age === 17 ? 1.18 : input.age === 18 ? 1.08 : 0.98;
  const professionalismFactor = 0.75 + input.professionalism / 200;
  const fatigueFactor = clamp(1 - input.fatigue / 130, 0.35, 1.05);
  const conditionFactor = clamp(0.65 + input.condition / 120, 0.65, 1.18);
  const potentialRoom = Math.max(0, input.potential - input.currentValue);
  const potentialFactor = clamp(0.2 + potentialRoom / 55, 0.2, 1.18);

  return roundGrowth(
    input.baseRate *
      ageFactor *
      professionalismFactor *
      fatigueFactor *
      conditionFactor *
      potentialFactor,
  );
}

function createReport(
  career: CareerState,
  source: DevelopmentSource,
  title: string,
  targets: GrowthTarget[],
  createdAt?: string,
): DevelopmentReport | null {
  const entries = targets
    .map((target) => {
      const before = getAttributeValue(career.player.attributes, target.attribute);
      const amount = calculateGrowthAmount({
        age: career.player.age,
        potential: career.player.potential,
        professionalism: career.player.attributes.career.professionalism,
        fatigue: career.fatigue,
        condition: career.condition,
        currentValue: before,
        baseRate: target.baseRate,
      });
      const after = roundAttribute(clamp(before + amount, 1, 100));

      return {
        attribute: target.attribute,
        label: ATTRIBUTE_LABELS[target.attribute],
        before,
        after,
        amount: roundGrowth(after - before),
      };
    })
    .filter((entry) => entry.amount > 0);

  if (entries.length === 0) {
    return null;
  }

  return {
    id: `week-${career.currentWeek}-${source}-${career.developmentLog.length + 1}`,
    week: career.currentWeek,
    source,
    title,
    entries,
    createdAt: createdAt ?? new Date().toISOString(),
  };
}

export function applyDevelopmentReport(
  career: CareerState,
  report: DevelopmentReport | null,
): CareerState {
  if (!report) {
    return career;
  }

  const updatedPlayer = report.entries.reduce(
    (player, entry) => setAttributeValue(player, entry.attribute, entry.after),
    career.player,
  );

  return {
    ...career,
    player: updatedPlayer,
    developmentLog: [...career.developmentLog, report].slice(-40),
  };
}

function getWeeklyGrowthTargets(input: WeeklyGrowthInput): GrowthTarget[] {
  switch (input.actionType) {
    case "teamTraining":
      return [
        { attribute: "mental.decisions", baseRate: 0.18 },
        { attribute: "mental.teamwork", baseRate: 0.16 },
        { attribute: "technical.firstTouch", baseRate: 0.08 },
      ];
    case "individualTraining":
      return input.attributeFocus
        ? [
            { attribute: input.attributeFocus, baseRate: 0.58 },
            { attribute: "mental.workRate", baseRate: 0.08 },
          ]
        : [];
    case "relationship":
      return [
        { attribute: "mental.teamwork", baseRate: 0.22 },
        { attribute: "mental.composure", baseRate: 0.06 },
      ];
    default:
      return [];
  }
}

export function applyWeeklyGrowth(
  career: CareerState,
  input: WeeklyGrowthInput,
): CareerState {
  const report = createReport(
    career,
    "weeklyTraining",
    "이번 주 훈련 성장",
    getWeeklyGrowthTargets(input),
    input.createdAt,
  );

  return applyDevelopmentReport(career, report);
}

function getMatchGrowthTargets(input: MatchGrowthInput): GrowthTarget[] {
  const targets: GrowthTarget[] = [];

  if (input.stats.goals > 0 || input.stats.shots > 0) {
    targets.push({
      attribute: "technical.finishing",
      baseRate: 0.12 + input.stats.goals * 0.08 + Math.min(input.stats.shots, 4) * 0.02,
    });
  }

  if (input.stats.assists > 0 || input.stats.keyPasses > 0) {
    targets.push({
      attribute: "technical.passing",
      baseRate: 0.12 + input.stats.assists * 0.08 + Math.min(input.stats.keyPasses, 4) * 0.02,
    });
    targets.push({ attribute: "mental.decisions", baseRate: 0.08 });
  }

  if (input.stats.tackles > 0) {
    targets.push({
      attribute: "technical.defending",
      baseRate: 0.1 + Math.min(input.stats.tackles, 5) * 0.025,
    });
  }

  if (input.stats.minutesPlayed >= 70) {
    targets.push({ attribute: "physical.stamina", baseRate: 0.1 });
  }

  if (input.rating >= 7) {
    targets.push({ attribute: "mental.composure", baseRate: 0.08 });
  }

  return targets;
}

export function applyMatchGrowth(career: CareerState, input: MatchGrowthInput): CareerState {
  const report = createReport(
    career,
    "match",
    "경기 경험 성장",
    getMatchGrowthTargets(input),
    input.createdAt,
  );

  return applyDevelopmentReport(career, report);
}
