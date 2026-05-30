import type {
  AttributeFocus,
  CareerEventLogEntry,
  CareerState,
  Player,
  WeeklyActionType,
} from "../domain/types";
import {
  applyWeeklyGrowth,
  ATTRIBUTE_LABELS,
  getAttributeValue,
} from "./growth";

export interface AttributeFocusOption {
  id: AttributeFocus;
  label: string;
}

export interface ApplyWeeklyActionInput {
  actionType: WeeklyActionType;
  attributeFocus?: AttributeFocus;
  createdAt?: string;
}

export const ATTRIBUTE_FOCUS_OPTIONS: AttributeFocusOption[] = [
  { id: "technical.finishing", label: ATTRIBUTE_LABELS["technical.finishing"] },
  { id: "technical.passing", label: ATTRIBUTE_LABELS["technical.passing"] },
  { id: "technical.dribbling", label: ATTRIBUTE_LABELS["technical.dribbling"] },
  { id: "technical.defending", label: ATTRIBUTE_LABELS["technical.defending"] },
  { id: "technical.firstTouch", label: ATTRIBUTE_LABELS["technical.firstTouch"] },
  { id: "physical.pace", label: ATTRIBUTE_LABELS["physical.pace"] },
  { id: "physical.stamina", label: ATTRIBUTE_LABELS["physical.stamina"] },
  { id: "physical.strength", label: ATTRIBUTE_LABELS["physical.strength"] },
  { id: "physical.agility", label: ATTRIBUTE_LABELS["physical.agility"] },
  { id: "mental.decisions", label: ATTRIBUTE_LABELS["mental.decisions"] },
  { id: "mental.composure", label: ATTRIBUTE_LABELS["mental.composure"] },
  { id: "mental.workRate", label: ATTRIBUTE_LABELS["mental.workRate"] },
  { id: "mental.teamwork", label: ATTRIBUTE_LABELS["mental.teamwork"] },
];

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function clampAttribute(value: number): number {
  return clamp(value, 1, 100);
}

function getCareerEventId(career: CareerState, actionType: WeeklyActionType): string {
  const eventNumber = (career.eventLog?.length ?? 0) + 1;
  return `week-${career.currentWeek}-${actionType}-${eventNumber}`;
}

function createEvent(
  career: CareerState,
  actionType: WeeklyActionType,
  title: string,
  description: string,
  createdAt?: string,
): CareerEventLogEntry {
  return {
    id: getCareerEventId(career, actionType),
    week: career.currentWeek,
    title,
    description,
    createdAt: createdAt ?? new Date().toISOString(),
  };
}

function withEvent(career: CareerState, event: CareerEventLogEntry): CareerState {
  return {
    ...career,
    eventLog: [...(career.eventLog ?? []), event].slice(-30),
  };
}

function applyMediaMentalRisk(player: Player): Player {
  return {
    ...player,
    attributes: {
      ...player.attributes,
      mental: {
        ...player.attributes.mental,
        composure: clampAttribute(player.attributes.mental.composure - 1),
      },
    },
  };
}

export function canSimulateCurrentMatch(career: CareerState): boolean {
  const hasPlayerMatch = career.season.matches.some(
    (match) =>
      match.status !== "played" &&
      match.week === career.currentWeek &&
      (match.homeClubId === career.player.clubId || match.awayClubId === career.player.clubId),
  );

  return Boolean(career.weeklyActionCompleted && hasPlayerMatch);
}

export function applyWeeklyAction(
  career: CareerState,
  input: ApplyWeeklyActionInput,
): CareerState {
  if (career.weeklyActionCompleted) {
    throw new Error("Weekly action has already been completed.");
  }

  switch (input.actionType) {
    case "teamTraining": {
      const updatedCareer: CareerState = {
        ...career,
        fatigue: clamp(career.fatigue + 6),
        condition: clamp(career.condition - 2),
        form: clamp(career.form + 1),
        coachTrust: clamp(career.coachTrust + 4),
        tacticalFit: clamp((career.tacticalFit ?? 42) + 6),
        weeklyActionCompleted: true,
      };
      const grownCareer = applyWeeklyGrowth(updatedCareer, {
        actionType: input.actionType,
        createdAt: input.createdAt,
      });

      return withEvent(
        grownCareer,
        createEvent(
          career,
          input.actionType,
          "팀 훈련 완료",
          "전술 이해도가 오르고 감독의 신뢰도 높아졌습니다.",
          input.createdAt,
        ),
      );
    }

    case "individualTraining": {
      if (!input.attributeFocus) {
        throw new Error("Individual training requires an attribute focus.");
      }

      const before = getAttributeValue(career.player.attributes, input.attributeFocus);
      const updatedCareer: CareerState = {
        ...career,
        fatigue: clamp(career.fatigue + 10),
        condition: clamp(career.condition - 4),
        form: clamp(career.form + 1),
        coachTrust: clamp(career.coachTrust + 1),
        weeklyActionCompleted: true,
      };
      const grownCareer = applyWeeklyGrowth(updatedCareer, {
        actionType: input.actionType,
        attributeFocus: input.attributeFocus,
        createdAt: input.createdAt,
      });
      const after = getAttributeValue(grownCareer.player.attributes, input.attributeFocus);
      const focusLabel = ATTRIBUTE_LABELS[input.attributeFocus];

      return withEvent(
        grownCareer,
        createEvent(
          career,
          input.actionType,
          "개인 훈련 완료",
          `${focusLabel} 능력치가 ${before.toFixed(2)}에서 ${after.toFixed(2)}로 올랐습니다.`,
          input.createdAt,
        ),
      );
    }

    case "recovery": {
      const updatedCareer: CareerState = {
        ...career,
        fatigue: clamp(career.fatigue - 16),
        condition: clamp(career.condition + 14),
        form: clamp(career.form + 2),
        weeklyActionCompleted: true,
      };

      return withEvent(
        updatedCareer,
        createEvent(
          career,
          input.actionType,
          "회복 집중",
          "몸 상태가 좋아지고 피로가 크게 내려갔습니다.",
          input.createdAt,
        ),
      );
    }

    case "mediaActivity": {
      const updatedCareer: CareerState = {
        ...career,
        player: applyMediaMentalRisk(career.player),
        fatigue: clamp(career.fatigue + 4),
        condition: clamp(career.condition - 2),
        form: clamp(career.form - 2),
        fanSupport: clamp(career.fanSupport + 6),
        reputation: clamp(career.reputation + 5),
        weeklyActionCompleted: true,
      };

      return withEvent(
        updatedCareer,
        createEvent(
          career,
          input.actionType,
          "미디어 활동",
          "팬 지지와 평판이 올랐지만 경기 집중력에는 작은 부담이 생겼습니다.",
          input.createdAt,
        ),
      );
    }

    case "relationship": {
      const updatedCareer: CareerState = {
        ...career,
        fatigue: clamp(career.fatigue + 1),
        form: clamp(career.form + 1),
        coachTrust: clamp(career.coachTrust + 2),
        fanSupport: clamp(career.fanSupport + 1),
        weeklyActionCompleted: true,
      };
      const grownCareer = applyWeeklyGrowth(updatedCareer, {
        actionType: input.actionType,
        createdAt: input.createdAt,
      });

      return withEvent(
        grownCareer,
        createEvent(
          career,
          input.actionType,
          "동료 관계 관리",
          "팀워크가 좋아지고 감독 신뢰도 조금 올랐습니다.",
          input.createdAt,
        ),
      );
    }

    default:
      return career;
  }
}
