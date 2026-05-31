import { ATTRIBUTE_LABELS } from "../domain/player";
import type {
  AttributeFocus,
  Attributes,
  CareerState,
  Club,
  DevelopmentReport,
  Player,
} from "../domain/types";

interface GrowthTarget {
  attribute: AttributeFocus;
  facility: keyof Club["trainingFacilities"];
  baseRate: number;
}

export interface MonthlyGrowthInput {
  month: number;
  playingTimeShare: number;
  createdAt?: string;
}

const MONTHLY_TARGETS: GrowthTarget[] = [
  { attribute: "technical.finishing", facility: "technicalTraining", baseRate: 0.18 },
  { attribute: "technical.passing", facility: "technicalTraining", baseRate: 0.18 },
  { attribute: "technical.dribbling", facility: "technicalTraining", baseRate: 0.16 },
  { attribute: "technical.defending", facility: "technicalTraining", baseRate: 0.14 },
  { attribute: "technical.firstTouch", facility: "technicalTraining", baseRate: 0.16 },
  { attribute: "physical.pace", facility: "physicalTraining", baseRate: 0.11 },
  { attribute: "physical.stamina", facility: "physicalTraining", baseRate: 0.2 },
  { attribute: "physical.strength", facility: "physicalTraining", baseRate: 0.14 },
  { attribute: "physical.agility", facility: "physicalTraining", baseRate: 0.13 },
  { attribute: "mental.decisions", facility: "tacticalTraining", baseRate: 0.18 },
  { attribute: "mental.composure", facility: "mentalTraining", baseRate: 0.14 },
  { attribute: "mental.workRate", facility: "mentalTraining", baseRate: 0.13 },
  { attribute: "mental.teamwork", facility: "tacticalTraining", baseRate: 0.13 },
  { attribute: "career.professionalism", facility: "mentalTraining", baseRate: 0.08 },
  { attribute: "career.adaptability", facility: "youthDevelopment", baseRate: 0.08 },
];

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getAttributeValue(attributes: Attributes, focus: AttributeFocus): number {
  const [group, key] = focus.split(".") as [keyof Attributes, string];
  const values = attributes[group] as unknown as Record<string, number>;

  return values[key];
}

export function setAttributeValue(player: Player, focus: AttributeFocus, value: number): Player {
  const [group, key] = focus.split(".") as [keyof Attributes, string];

  return {
    ...player,
    attributes: {
      ...player.attributes,
      [group]: {
        ...player.attributes[group],
        [key]: round(clamp(value, 1, 99)),
      },
    },
  };
}

export function calculateMonthlyGrowthAmount(input: {
  age: number;
  potential: number;
  professionalism: number;
  currentValue: number;
  facilityValue: number;
  playingTimeShare: number;
  form: number;
  fatigue: number;
  injuryPenalty: number;
  baseRate: number;
}): number {
  const ageFactor =
    input.age <= 16 ? 1.34 : input.age === 17 ? 1.24 : input.age === 18 ? 1.14 : input.age === 19 ? 1.06 : 0.96;
  const potentialRoom = Math.max(0, input.potential - input.currentValue);
  const potentialFactor = clamp(0.25 + potentialRoom / 48, 0.2, 1.28);
  const facilityFactor = clamp(0.55 + input.facilityValue / 95, 0.65, 1.55);
  const professionalismFactor = clamp(0.72 + input.professionalism / 160, 0.75, 1.36);
  const playingTimeFactor = clamp(0.88 + input.playingTimeShare * 0.32, 0.82, 1.2);
  const formFactor = clamp(0.75 + input.form / 180, 0.78, 1.22);
  const fatigueFactor = clamp(1 - input.fatigue / 150, 0.42, 1.05);

  return round(
    input.baseRate *
      ageFactor *
      potentialFactor *
      facilityFactor *
      professionalismFactor *
      playingTimeFactor *
      formFactor *
      fatigueFactor *
      input.injuryPenalty,
  );
}

export function createMonthlyDevelopmentReport(
  career: CareerState,
  club: Club,
  input: MonthlyGrowthInput,
): DevelopmentReport | null {
  const medicalSupport = club.trainingFacilities.medicalSupport;
  const injuryPenalty =
    career.injury.severity === "major"
      ? clamp(0.28 + medicalSupport / 280, 0.28, 0.55)
      : career.injury.severity === "minor"
        ? clamp(0.62 + medicalSupport / 320, 0.62, 0.86)
        : 1;
  const effectiveFatigue = Math.max(0, career.fatigue - medicalSupport * 0.16);
  const entries = MONTHLY_TARGETS.map((target) => {
    const before = getAttributeValue(career.player.attributes, target.attribute);
    const amount = calculateMonthlyGrowthAmount({
      age: career.player.age,
      potential: career.player.potential,
      professionalism: career.player.attributes.career.professionalism,
      currentValue: before,
      facilityValue: club.trainingFacilities[target.facility],
      playingTimeShare: input.playingTimeShare,
      form: career.form,
      fatigue: effectiveFatigue,
      injuryPenalty,
      baseRate: target.baseRate,
    });

    return {
      attribute: target.attribute,
      label: ATTRIBUTE_LABELS[target.attribute],
      before,
      after: round(clamp(before + amount, 1, 99)),
      amount,
    };
  }).filter((entry) => entry.amount > 0);

  if (entries.length === 0) {
    return null;
  }

  return {
    id: `season-${career.season.number}-month-${input.month}-growth-${career.monthlyDevelopmentLog.length + 1}`,
    month: input.month,
    source: "clubTraining",
    title: "월간 성장 리포트",
    entries,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function applyMonthlyGrowth(
  career: CareerState,
  club: Club,
  input: MonthlyGrowthInput,
): CareerState {
  const report = createMonthlyDevelopmentReport(career, club, input);

  if (!report) {
    return career;
  }

  const player = report.entries.reduce(
    (currentPlayer, entry) => setAttributeValue(currentPlayer, entry.attribute, entry.after),
    career.player,
  );

  return {
    ...career,
    player,
    monthlyDevelopmentLog: [...career.monthlyDevelopmentLog, report].slice(-48),
  };
}
