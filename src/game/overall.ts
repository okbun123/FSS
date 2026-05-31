import type { AttributeFocus, Player, Position } from "../domain/types";
import { getAttributeValue } from "./monthlyGrowth";

export const POSITION_WEIGHTS: Record<Position, Partial<Record<AttributeFocus, number>>> = {
  ST: {
    "technical.finishing": 22,
    "technical.firstTouch": 12,
    "technical.dribbling": 10,
    "physical.pace": 12,
    "physical.strength": 7,
    "mental.composure": 15,
    "mental.decisions": 12,
    "mental.workRate": 10,
  },
  LW: {
    "technical.dribbling": 20,
    "technical.passing": 10,
    "technical.finishing": 11,
    "technical.firstTouch": 10,
    "physical.pace": 18,
    "physical.agility": 14,
    "mental.decisions": 9,
    "mental.workRate": 8,
  },
  RW: {
    "technical.dribbling": 20,
    "technical.passing": 10,
    "technical.finishing": 11,
    "technical.firstTouch": 10,
    "physical.pace": 18,
    "physical.agility": 14,
    "mental.decisions": 9,
    "mental.workRate": 8,
  },
  AM: {
    "technical.passing": 18,
    "technical.dribbling": 14,
    "technical.firstTouch": 15,
    "technical.finishing": 9,
    "mental.decisions": 18,
    "mental.composure": 12,
    "physical.agility": 8,
    "mental.teamwork": 6,
  },
  CM: {
    "technical.passing": 18,
    "technical.firstTouch": 13,
    "physical.stamina": 14,
    "mental.decisions": 15,
    "mental.workRate": 15,
    "mental.teamwork": 13,
    "technical.defending": 7,
    "technical.dribbling": 5,
  },
  DM: {
    "technical.defending": 20,
    "technical.passing": 13,
    "technical.firstTouch": 8,
    "physical.stamina": 12,
    "physical.strength": 13,
    "mental.decisions": 15,
    "mental.workRate": 12,
    "mental.teamwork": 7,
  },
  FB: {
    "technical.defending": 16,
    "technical.passing": 9,
    "technical.dribbling": 8,
    "physical.pace": 16,
    "physical.stamina": 18,
    "physical.agility": 9,
    "mental.workRate": 15,
    "mental.teamwork": 9,
  },
  CB: {
    "technical.defending": 25,
    "technical.passing": 7,
    "physical.strength": 18,
    "physical.stamina": 8,
    "mental.decisions": 16,
    "mental.composure": 14,
    "mental.teamwork": 8,
    "technical.firstTouch": 4,
  },
};

function clamp(value: number, min = 1, max = 99): number {
  return Math.max(min, Math.min(max, value));
}

function getFootBonus(player: Pick<Player, "leftFoot" | "rightFoot">, position: Position): number {
  const weakFoot = Math.min(player.leftFoot, player.rightFoot);
  const twoFootedBonus = weakFoot >= 15 ? 2.2 : weakFoot >= 12 ? 1.2 : weakFoot >= 8 ? 0.5 : 0;
  const sideBonus =
    (position === "LW" && player.rightFoot === 20) || (position === "RW" && player.leftFoot === 20)
      ? 0.8
      : 0;

  return twoFootedBonus + sideBonus;
}

export function calculateOverall(player: Player, position: Position = player.selectedPosition): number {
  const weights = POSITION_WEIGHTS[position];
  const totalWeight = Object.values(weights).reduce((total, weight) => total + (weight ?? 0), 0);
  const weightedTotal = (Object.entries(weights) as Array<[AttributeFocus, number]>).reduce(
    (total, [attribute, weight]) => total + getAttributeValue(player.attributes, attribute) * weight,
    0,
  );
  const roleScore = weightedTotal / totalWeight;
  const professionalismBonus = (player.attributes.career.professionalism - 50) / 18;
  const potentialSignal = Math.max(0, player.potential - roleScore) / 40;

  return Math.round(clamp(roleScore + getFootBonus(player, position) + professionalismBonus + potentialSignal));
}

export function calculateMarketValue(player: Player, reputation = player.reputation): number {
  const ageMultiplier = player.age <= 18 ? 1.25 : player.age <= 21 ? 1.15 : player.age <= 25 ? 1 : 0.82;
  const potentialPremium = Math.max(0, player.potential - player.OVR) * 850;
  const ovrValue = player.OVR * player.OVR * 42;
  const reputationValue = reputation * 720;

  return Math.round((ovrValue + potentialPremium + reputationValue) * ageMultiplier);
}
