import type { WeeklyAction } from "../domain/types";

export const WEEKLY_ACTIONS: WeeklyAction[] = [
  {
    type: "teamTraining",
    label: "팀 훈련",
    description: "팀 전술과 조직력을 맞추는 기본 훈련입니다.",
    fatigueChange: 8,
    conditionChange: -4,
  },
  {
    type: "individualTraining",
    label: "개인 훈련",
    description: "선수의 핵심 능력치를 집중적으로 갈고닦습니다.",
    fatigueChange: 12,
    conditionChange: -6,
  },
  {
    type: "recovery",
    label: "회복",
    description: "컨디션을 회복하고 피로를 낮춥니다.",
    fatigueChange: -14,
    conditionChange: 12,
  },
  {
    type: "mediaActivity",
    label: "미디어 활동",
    description: "팬 지지와 명성을 높이는 외부 활동입니다.",
    fatigueChange: 5,
    conditionChange: -2,
  },
  {
    type: "relationship",
    label: "관계 관리",
    description: "감독과 동료의 신뢰를 쌓는 시간을 보냅니다.",
    fatigueChange: 2,
    conditionChange: 0,
  },
];
