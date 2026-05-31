import type { AttributeFocus, Position } from "./types";

export type PositionAttributeKey = AttributeFocus | "footedness";
export type PositionKeyAttributeRole = "primary" | "secondary";

export interface PositionKeyAttributeDefinition {
  primary: PositionAttributeKey[];
  secondary: PositionAttributeKey[];
}

export const POSITION_KEY_ATTRIBUTES: Record<Position, PositionKeyAttributeDefinition> = {
  ST: {
    primary: ["technical.finishing", "technical.shooting", "mental.composure", "physical.strength"],
    secondary: ["technical.heading", "physical.speed", "technical.firstTouch"],
  },
  LW: {
    primary: ["physical.speed", "physical.acceleration", "technical.dribbling", "technical.crossing"],
    secondary: ["technical.firstTouch", "technical.passing", "footedness"],
  },
  RW: {
    primary: ["physical.speed", "physical.acceleration", "technical.dribbling", "technical.crossing"],
    secondary: ["technical.firstTouch", "technical.passing", "footedness"],
  },
  AM: {
    primary: ["technical.passing", "technical.dribbling", "technical.firstTouch", "mental.decisions"],
    secondary: ["mental.composure", "technical.shooting", "physical.agility"],
  },
  CM: {
    primary: ["technical.passing", "physical.stamina", "mental.decisions", "technical.firstTouch"],
    secondary: ["technical.tackling", "mental.concentration", "mental.composure"],
  },
  DM: {
    primary: ["technical.tackling", "technical.marking", "physical.strength", "physical.stamina"],
    secondary: ["mental.concentration", "technical.passing", "mental.decisions"],
  },
  FB: {
    primary: ["physical.speed", "physical.stamina", "technical.crossing", "technical.tackling"],
    secondary: ["technical.marking", "physical.acceleration", "technical.passing"],
  },
  CB: {
    primary: ["technical.marking", "technical.tackling", "technical.heading", "physical.strength"],
    secondary: ["mental.concentration", "mental.composure", "technical.passing"],
  },
};

export function getPositionKeyAttributeRole(
  position: Position | undefined,
  attribute: PositionAttributeKey,
): PositionKeyAttributeRole | undefined {
  if (!position) {
    return undefined;
  }

  const definition = POSITION_KEY_ATTRIBUTES[position];

  if (definition.primary.includes(attribute)) {
    return "primary";
  }

  if (definition.secondary.includes(attribute)) {
    return "secondary";
  }

  return undefined;
}

export function isPositionKeyAttribute(
  position: Position | undefined,
  attribute: PositionAttributeKey,
): boolean {
  return Boolean(getPositionKeyAttributeRole(position, attribute));
}
