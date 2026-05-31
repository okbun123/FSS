import { createStablePlayerId } from "../domain/player";
import type {
  Attributes,
  Footedness,
  Personality,
  Player,
  Position,
  PositionRecommendation,
} from "../domain/types";
import { createSeededRandom, type RandomSource } from "./random";
import { calculateMarketValue, calculateOverall } from "./overall";
import { recommendPositions } from "./positionRecommendation";

export interface PlayerRoll {
  seed: string;
  age: number;
  personality: Personality;
  potential: number;
  dominantFoot: Footedness;
  leftFoot: number;
  rightFoot: number;
  attributes: Attributes;
  recommendations: PositionRecommendation[];
  archetype: string;
}

export interface CreatePlayerFromRollInput {
  name: string;
  nationality: string;
  clubId: string;
  position: Position;
  roll: PlayerRoll;
}

type AttributeGroup = keyof Attributes;
type AttributeKey<Group extends AttributeGroup> = keyof Attributes[Group];

type AttributePatch = {
  [Group in AttributeGroup]?: Partial<Record<AttributeKey<Group>, number>>;
};

interface Archetype {
  id: string;
  label: string;
  modifiers: AttributePatch;
}

const ARCHETYPES: Archetype[] = [
  {
    id: "scorer",
    label: "골 냄새가 좋은 공격수형",
    modifiers: {
      technical: { finishing: 12, firstTouch: 5 },
      mental: { composure: 8 },
      physical: { pace: 4 },
    },
  },
  {
    id: "creator",
    label: "패스와 시야가 좋은 창조자형",
    modifiers: {
      technical: { passing: 12, firstTouch: 7, dribbling: 4 },
      mental: { decisions: 9, teamwork: 4 },
    },
  },
  {
    id: "runner",
    label: "폭발력이 돋보이는 러너형",
    modifiers: {
      physical: { pace: 12, agility: 10, stamina: 6 },
      technical: { dribbling: 6 },
    },
  },
  {
    id: "engine",
    label: "성실하게 뛰는 엔진형",
    modifiers: {
      physical: { stamina: 12 },
      mental: { workRate: 12, teamwork: 7 },
      career: { professionalism: 7 },
    },
  },
  {
    id: "defender",
    label: "대인 수비가 좋은 수비수형",
    modifiers: {
      technical: { defending: 14, passing: 3 },
      physical: { strength: 9 },
      mental: { decisions: 6, composure: 5 },
    },
  },
  {
    id: "technician",
    label: "볼을 다루는 감각이 좋은 테크니션형",
    modifiers: {
      technical: { dribbling: 10, firstTouch: 10, passing: 5 },
      physical: { agility: 6 },
      mental: { composure: 4 },
    },
  },
];

const PERSONALITY_WEIGHTS: Array<[Personality, number]> = [
  ["diligent", 30],
  ["ambitious", 24],
  ["teamPlayer", 22],
  ["star", 14],
  ["maverick", 10],
];

function clamp(value: number, min = 1, max = 99): number {
  return Math.max(min, Math.min(max, value));
}

function weightedPick<T>(rng: RandomSource, values: Array<[T, number]>): T {
  const total = values.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;

  for (const [value, weight] of values) {
    roll -= weight;
    if (roll <= 0) {
      return value;
    }
  }

  return values[values.length - 1][0];
}

function randomInt(rng: RandomSource, min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1));
}

function rollYouthAttribute(rng: RandomSource, age: number): number {
  const base =
    rng() < 0.08
      ? randomInt(rng, 55, 66)
      : rng() < 0.28
        ? randomInt(rng, 46, 55)
        : randomInt(rng, 32, 48);
  const ageMaturity = Math.max(0, age - 16) * randomInt(rng, 1, 3);

  return clamp(base + ageMaturity, 18, 76);
}

function createBaseAttributes(rng: RandomSource, age: number): Attributes {
  return {
    technical: {
      finishing: rollYouthAttribute(rng, age),
      passing: rollYouthAttribute(rng, age),
      dribbling: rollYouthAttribute(rng, age),
      defending: rollYouthAttribute(rng, age),
      firstTouch: rollYouthAttribute(rng, age),
    },
    physical: {
      pace: rollYouthAttribute(rng, age),
      stamina: rollYouthAttribute(rng, age),
      strength: rollYouthAttribute(rng, age),
      agility: rollYouthAttribute(rng, age),
    },
    mental: {
      decisions: rollYouthAttribute(rng, age),
      composure: rollYouthAttribute(rng, age),
      workRate: rollYouthAttribute(rng, age),
      teamwork: rollYouthAttribute(rng, age),
    },
    career: {
      professionalism: rollYouthAttribute(rng, age),
      adaptability: rollYouthAttribute(rng, age),
      leadership: clamp(rollYouthAttribute(rng, age) - 6, 18, 76),
      marketability: clamp(rollYouthAttribute(rng, age) - 4, 18, 76),
    },
  };
}

function applyGroupPatch<Group extends AttributeGroup>(
  group: Attributes[Group],
  patch: Partial<Record<AttributeKey<Group>, number>> | undefined,
): Attributes[Group] {
  return {
    ...group,
    ...Object.fromEntries(
      Object.entries(patch ?? {}).map(([key, value]) => {
        const currentValue = group[key as AttributeKey<Group>] ?? 0;

        return [key, clamp(Number(currentValue) + Number(value))];
      }),
    ),
  };
}

function applyPatch(attributes: Attributes, patch: AttributePatch): Attributes {
  return {
    technical: applyGroupPatch<"technical">(attributes.technical, patch.technical),
    physical: applyGroupPatch<"physical">(attributes.physical, patch.physical),
    mental: applyGroupPatch<"mental">(attributes.mental, patch.mental),
    career: applyGroupPatch<"career">(attributes.career, patch.career),
  };
}

function applyPersonality(attributes: Attributes, personality: Personality): Attributes {
  const patches: Record<Personality, AttributePatch> = {
    diligent: { career: { professionalism: 9 }, mental: { workRate: 5, teamwork: 2 } },
    ambitious: { career: { professionalism: 4, leadership: 5 }, mental: { composure: 3 } },
    star: { career: { marketability: 10 }, technical: { dribbling: 3 } },
    teamPlayer: { mental: { teamwork: 9, decisions: 2 }, career: { leadership: 2 } },
    maverick: { technical: { dribbling: 5 }, career: { adaptability: 6, professionalism: -5 }, mental: { teamwork: -4 } },
  };

  return applyPatch(attributes, patches[personality]);
}

function rollPotential(rng: RandomSource, age: number, personality: Personality): number {
  const base =
    rng() < 0.06
      ? randomInt(rng, 90, 95)
      : rng() < 0.24
        ? randomInt(rng, 84, 90)
        : randomInt(rng, 72, 85);
  const ageBonus = age === 16 ? 4 : age === 17 ? 3 : age === 18 ? 2 : age === 19 ? 1 : 0;
  const personalityBonus = personality === "ambitious" ? 2 : personality === "diligent" ? 2 : personality === "maverick" ? -1 : 0;

  return clamp(base + ageBonus + personalityBonus, 72, 95);
}

function rollWeakerFoot(rng: RandomSource): number {
  const roll = rng();

  if (roll < 0.06) {
    return randomInt(rng, 16, 18);
  }
  if (roll < 0.28) {
    return randomInt(rng, 10, 15);
  }
  if (roll < 0.68) {
    return randomInt(rng, 5, 9);
  }
  return randomInt(rng, 1, 4);
}

function rollFootedness(rng: RandomSource): { dominantFoot: Footedness; leftFoot: number; rightFoot: number } {
  const dominant = rng() < 0.72 ? "right" : "left";
  const weaker = rollWeakerFoot(rng);

  return dominant === "right"
    ? { dominantFoot: "right", rightFoot: 20, leftFoot: weaker }
    : { dominantFoot: "left", leftFoot: 20, rightFoot: weaker };
}

function getYouthGrowthRoom(age: number): number {
  if (age === 16) {
    return 10;
  }
  if (age === 17) {
    return 8;
  }
  if (age === 18) {
    return 6;
  }
  if (age === 19) {
    return 4;
  }
  return 2;
}

export function generatePlayerRoll(seed: string | number = Date.now()): PlayerRoll {
  const seedText = String(seed);
  const rng = createSeededRandom(seedText);
  const age = weightedPick(rng, [
    [16, 18],
    [17, 28],
    [18, 28],
    [19, 18],
    [20, 8],
  ]);
  const personality = weightedPick(rng, PERSONALITY_WEIGHTS);
  const archetype = weightedPick(
    rng,
    ARCHETYPES.map((candidate) => [candidate, 1] as [Archetype, number]),
  );
  const attributes = applyPersonality(applyPatch(createBaseAttributes(rng, age), archetype.modifiers), personality);
  const footedness = rollFootedness(rng);
  const basePotential = rollPotential(rng, age, personality);
  const previewRecommendations = recommendPositions({
    attributes,
    potential: basePotential,
    leftFoot: footedness.leftFoot,
    rightFoot: footedness.rightFoot,
  });
  const topOverall = previewRecommendations[0]?.overall ?? 50;
  const potential = Math.max(
    basePotential,
    Math.min(95, topOverall + getYouthGrowthRoom(age) + randomInt(rng, 0, 3)),
  );
  const recommendations = recommendPositions({
    attributes,
    potential,
    leftFoot: footedness.leftFoot,
    rightFoot: footedness.rightFoot,
  });

  return {
    seed: seedText,
    age,
    personality,
    potential,
    attributes,
    ...footedness,
    recommendations,
    archetype: archetype.label,
  };
}

export function createPlayerFromRoll(input: CreatePlayerFromRollInput): Player {
  const normalizedName = input.name.trim();
  const normalizedNationality = input.nationality.trim();
  const basePlayer: Player = {
    id: createStablePlayerId(
      `${normalizedName}-${normalizedNationality}-${input.roll.seed}-${input.position}-${input.clubId}`,
    ),
    name: normalizedName,
    nationality: normalizedNationality,
    age: input.roll.age,
    selectedPosition: input.position,
    recommendedPositions: input.roll.recommendations,
    attributes: input.roll.attributes,
    leftFoot: input.roll.leftFoot,
    rightFoot: input.roll.rightFoot,
    dominantFoot: input.roll.dominantFoot,
    OVR: 1,
    potential: input.roll.potential,
    form: 50,
    condition: 82,
    fatigue: 14,
    reputation: 28,
    coachTrust: 42,
    marketValue: 0,
    clubId: input.clubId,
    personality: input.roll.personality,
    position: input.position,
  };
  const OVR = calculateOverall(basePlayer, input.position);

  return {
    ...basePlayer,
    OVR,
    marketValue: calculateMarketValue({ ...basePlayer, OVR }),
  };
}
