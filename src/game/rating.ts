import type { KeyMoment, PlayerMatchStats, RatingModifier } from "../domain/types";

export interface RatingInput {
  stats: PlayerMatchStats;
  keyMoments: KeyMoment[];
  teamGoalsFor: number;
  teamGoalsAgainst: number;
  condition: number;
  fatigue: number;
  form: number;
}

export interface RatingResult {
  rating: number;
  modifiers: RatingModifier[];
}

function roundModifier(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampRating(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value * 10) / 10));
}

function createModifier(label: string, value: number): RatingModifier {
  return {
    label,
    value: roundModifier(value),
    kind: value > 0 ? "positive" : value < 0 ? "negative" : "neutral",
  };
}

export function calculatePlayerRating(input: RatingInput): RatingResult {
  const successfulMoments = input.keyMoments.filter(
    (moment) => moment.outcome?.successful,
  ).length;
  const failedMoments = input.keyMoments.filter(
    (moment) => moment.outcome && !moment.outcome.successful,
  ).length;
  const resultModifier =
    input.teamGoalsFor > input.teamGoalsAgainst
      ? 0.25
      : input.teamGoalsFor === input.teamGoalsAgainst
        ? 0.05
        : -0.2;
  const conditionModifier = input.condition >= 75 ? 0.15 : input.condition < 60 ? -0.3 : 0;
  const fatigueModifier = input.fatigue >= 65 ? -0.35 : input.fatigue >= 45 ? -0.15 : 0;
  const formModifier = (input.form - 50) / 100;

  const modifiers: RatingModifier[] = [
    createModifier("기본 평점", 6),
    createModifier("득점", input.stats.goals * 0.9),
    createModifier("도움", input.stats.assists * 0.7),
    createModifier("슈팅", input.stats.shots * 0.08),
    createModifier("키 패스", input.stats.keyPasses * 0.18),
    createModifier("태클", input.stats.tackles * 0.12),
    createModifier("성공한 핵심 장면", successfulMoments * 0.35),
    createModifier("실패한 핵심 장면", failedMoments * -0.25),
    createModifier("턴오버", input.stats.turnovers * -0.18),
    createModifier("경기 결과", resultModifier),
    createModifier("컨디션", conditionModifier),
    createModifier("피로도", fatigueModifier),
    createModifier("최근 폼", formModifier),
  ].filter((modifier) => modifier.value !== 0 || modifier.label === "기본 평점");

  const rating = clampRating(
    modifiers.reduce((total, modifier) => total + modifier.value, 0),
  );

  return { rating, modifiers };
}
