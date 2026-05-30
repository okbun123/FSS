import type { WeeklyAction } from "../domain/types";

export const WEEKLY_ACTIONS: WeeklyAction[] = [
  {
    type: "teamTraining",
    label: "팀 훈련",
    description: "팀 전술 이해도와 감독 신뢰를 함께 올립니다.",
    fatigueChange: 6,
    conditionChange: -2,
  },
  {
    type: "individualTraining",
    label: "개인 훈련",
    description: "선택한 능력치를 집중적으로 성장시킵니다.",
    fatigueChange: 10,
    conditionChange: -4,
  },
  {
    type: "recovery",
    label: "회복",
    description: "컨디션을 회복하고 피로를 크게 낮춥니다.",
    fatigueChange: -16,
    conditionChange: 14,
  },
  {
    type: "mediaActivity",
    label: "미디어 활동",
    description: "평판과 팬 지지를 높이지만 집중력이 흔들릴 수 있습니다.",
    fatigueChange: 4,
    conditionChange: -2,
  },
  {
    type: "relationship",
    label: "동료 관계 관리",
    description: "팀워크를 높이고 감독 신뢰도 조금 얻습니다.",
    fatigueChange: 1,
    conditionChange: 0,
  },
];
