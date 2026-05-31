import type {
  CareerState,
  MonthlyEvent,
  MonthlyEventChoice,
  MonthlyEventEffect,
  MonthlyEventType,
} from "../domain/types";
import { calculateMarketValue, calculateOverall } from "./overall";
import { createSeededRandom } from "./random";

export const MONTHLY_EVENT_TYPES: MonthlyEventType[] = [
  "coach_feedback",
  "training_report",
  "media_attention",
  "transfer_rumor",
  "rival_competition",
  "injury_warning",
  "first_team_chance",
  "contract_discussion",
  "fan_reaction",
  "tactical_role_change",
];

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function choice(
  id: string,
  label: string,
  description: string,
  effect: MonthlyEventEffect,
): MonthlyEventChoice {
  return { id, label, description, effect };
}

function eventCopy(type: MonthlyEventType): Pick<MonthlyEvent, "title" | "description" | "choices"> {
  switch (type) {
    case "coach_feedback":
      return {
        title: "감독 면담",
        description: "감독이 최근 훈련 태도와 출전 준비에 대해 짧은 면담을 요청했습니다.",
        choices: [
          choice("listen", "조용히 받아들인다", "팀 안에서 신뢰를 조금씩 쌓는 안정적인 선택입니다.", { coachTrust: 4, professionalism: 1 }),
          choice("ask_minutes", "출전 기회를 묻는다", "경쟁 의지를 보이지만 약간의 부담도 생깁니다.", { coachTrust: 2, form: 2, fatigue: 2 }),
          choice("ask_role", "원하는 역할을 설명한다", "전술 적응력을 보여 주며 역할 논의가 넓어집니다.", { coachTrust: 1, adaptability: 2 }),
        ],
      };
    case "training_report":
      return {
        title: "훈련 리포트",
        description: "코칭스태프가 이번 달 훈련 데이터와 성장 방향을 공유했습니다.",
        choices: [
          choice("routine", "기본 루틴을 유지한다", "컨디션을 관리하면서 시설 효과를 꾸준히 받습니다.", { condition: 2, professionalism: 1 }),
          choice("extra", "추가 훈련을 요청한다", "성장 의지는 좋지만 피로가 쌓일 수 있습니다.", { coachTrust: 2, fatigue: 5, professionalism: 2 }),
          choice("recovery", "회복 훈련을 늘린다", "피로와 부상 위험을 낮추는 달을 보냅니다.", { fatigue: -8, condition: 4, injuryRisk: -4 }),
        ],
      };
    case "media_attention":
      return {
        title: "지역 매체 인터뷰",
        description: "지역 매체가 떠오르는 유망주로 선수를 조명하려 합니다.",
        choices: [
          choice("humble", "팀을 먼저 언급한다", "평판과 팀워크를 함께 챙기는 선택입니다.", { reputation: 3, coachTrust: 1 }),
          choice("bold", "큰 목표를 말한다", "화제성은 커지지만 부담도 따라옵니다.", { reputation: 5, form: -1, marketability: 2 }),
        ],
      };
    case "transfer_rumor":
      return {
        title: "이적 루머",
        description: "다른 구단 스카우트가 관중석에 있었다는 이야기가 돌고 있습니다.",
        choices: [
          choice("focus", "현재 팀에 집중한다고 말한다", "감독 신뢰를 지키면서 평판도 조금 오릅니다.", { coachTrust: 3, reputation: 1 }),
          choice("open", "가능성을 열어 둔다", "시장 관심은 올라가지만 구단 내부 시선은 흔들릴 수 있습니다.", { reputation: 4, coachTrust: -2, marketability: 1 }),
          choice("quiet", "공개 반응을 피한다", "소란을 줄이고 컨디션 관리에 집중합니다.", { condition: 2, fatigue: -2 }),
        ],
      };
    case "rival_competition":
      return {
        title: "동료와의 포지션 경쟁",
        description: "같은 포지션의 어린 선수가 훈련장에서 좋은 평가를 받았습니다.",
        choices: [
          choice("compete", "정면으로 경쟁한다", "폼과 집중력을 끌어올리지만 피로도 쌓입니다.", { form: 3, fatigue: 3, professionalism: 1 }),
          choice("learn", "함께 분석하며 배운다", "팀워크와 감독 신뢰를 얻는 차분한 선택입니다.", { coachTrust: 2, adaptability: 1 }),
          choice("specialize", "자신의 강점을 더 갈고닦는다", "개성을 살리며 평판을 조금 높입니다.", { reputation: 1, form: 2, fatigue: 1 }),
        ],
      };
    case "injury_warning":
      return {
        title: "몸 상태 경고",
        description: "메디컬팀이 누적 피로가 올라오고 있다고 알려 왔습니다.",
        choices: [
          choice("rest", "회복 프로그램을 따른다", "피로를 낮추고 부상 위험을 줄입니다.", { fatigue: -10, condition: 4, injuryRisk: -8 }),
          choice("manage", "훈련 강도만 낮춘다", "성장 리듬을 유지하면서 위험을 조금 낮춥니다.", { fatigue: -5, condition: 2, injuryRisk: -3 }),
          choice("push", "출전 경쟁을 위해 강행한다", "단기 신뢰는 얻지만 부상 위험이 커집니다.", { coachTrust: 2, fatigue: 8, injuryRisk: 14 }),
        ],
      };
    case "first_team_chance":
      return {
        title: "1군 기회",
        description: "주전 선수의 결장으로 벤치 명단 진입 가능성이 생겼습니다.",
        choices: [
          choice("ready", "지금 출전해도 된다고 말한다", "감독 신뢰와 폼을 동시에 끌어올립니다.", { coachTrust: 4, form: 2 }),
          choice("safe", "무리하지 않고 다음을 기다린다", "컨디션 관리에 좋은 선택입니다.", { condition: 4, fatigue: -4 }),
          choice("impact", "짧은 시간에 승부를 보겠다고 한다", "임팩트를 노리지만 부담감도 커집니다.", { coachTrust: 2, reputation: 2, form: -1 }),
        ],
      };
    case "contract_discussion":
      return {
        title: "계약 관련 대화",
        description: "에이전트가 현재 계약과 출전 기회에 대한 의견을 물었습니다.",
        choices: [
          choice("patient", "성장을 우선하겠다고 한다", "장기 성장에 초점을 둔 안정적인 선택입니다.", { professionalism: 1, coachTrust: 2 }),
          choice("demand", "역할 확대를 원한다고 말한다", "야망은 드러나지만 내부 압박이 커집니다.", { reputation: 2, coachTrust: -1, form: 1 }),
          choice("market", "시장 반응을 확인한다", "시장성은 오르지만 집중력이 흔들릴 수 있습니다.", { marketability: 2, reputation: 1, form: -1 }),
        ],
      };
    case "fan_reaction":
      return {
        title: "팬 반응",
        description: "최근 경기와 훈련 공개 영상에 대한 팬들의 반응이 올라오고 있습니다.",
        choices: [
          choice("thank", "팬들에게 감사 인사를 남긴다", "평판과 시장성이 함께 조금 오릅니다.", { reputation: 2, marketability: 1 }),
          choice("focus", "반응을 보지 않고 훈련에 집중한다", "외부 소음을 줄이고 프로 의식을 지킵니다.", { professionalism: 1, condition: 1 }),
          choice("promise", "더 좋은 모습을 약속한다", "기대감이 커지며 폼에도 작은 자극을 줍니다.", { reputation: 3, form: 1, fatigue: 1 }),
        ],
      };
    case "tactical_role_change":
      return {
        title: "전술 역할 변화",
        description: "코칭스태프가 다음 달부터 다른 역할도 시험해 보자고 제안했습니다.",
        choices: [
          choice("accept", "새 역할을 받아들인다", "적응력과 감독 신뢰를 얻는 선택입니다.", { coachTrust: 2, adaptability: 3 }),
          choice("specialist", "주 포지션에 집중하고 싶다고 말한다", "정체성을 지키지만 전술 선택지는 줄어듭니다.", { form: 2, coachTrust: -1 }),
          choice("balanced", "훈련에서는 실험하고 경기는 익숙한 역할로 간다", "리스크를 줄인 균형 잡힌 선택입니다.", { adaptability: 1, condition: 1 }),
        ],
      };
  }
}

export function generateMonthlyEvent(career: CareerState): MonthlyEvent | undefined {
  if (career.season.isComplete) {
    return undefined;
  }

  const seed = `${career.player.id}-${career.season.number}-${career.season.currentMonth}`;
  const rng = createSeededRandom(seed);

  if (rng() > 0.72) {
    return undefined;
  }

  const type = MONTHLY_EVENT_TYPES[Math.floor(rng() * MONTHLY_EVENT_TYPES.length)];
  const copy = eventCopy(type);

  return {
    id: `season-${career.season.number}-month-${career.season.currentMonth}-${type}`,
    month: career.season.currentMonth,
    type,
    ...copy,
  };
}

export function applyMonthlyEventChoice(
  career: CareerState,
  event: MonthlyEvent | undefined,
  selectedChoiceId?: string,
): CareerState {
  if (!event) {
    return career;
  }

  const selectedChoice = event.choices.find((candidate) => candidate.id === selectedChoiceId) ?? event.choices[0];
  const effect = selectedChoice.effect;
  const nextCoachTrust = clamp(career.coachTrust + (effect.coachTrust ?? 0));
  const nextReputation = clamp(career.reputation + (effect.reputation ?? 0));
  const nextForm = clamp(career.form + (effect.form ?? 0));
  const nextCondition = clamp(career.condition + (effect.condition ?? 0));
  const nextFatigue = clamp(career.fatigue + (effect.fatigue ?? 0));
  const playerBase = {
    ...career.player,
    form: nextForm,
    condition: nextCondition,
    fatigue: nextFatigue,
    reputation: nextReputation,
    coachTrust: nextCoachTrust,
    attributes: {
      ...career.player.attributes,
      career: {
        ...career.player.attributes.career,
        professionalism: clamp(career.player.attributes.career.professionalism + (effect.professionalism ?? 0), 1, 99),
        adaptability: clamp(career.player.attributes.career.adaptability + (effect.adaptability ?? 0), 1, 99),
        marketability: clamp(career.player.attributes.career.marketability + (effect.marketability ?? 0), 1, 99),
      },
    },
  };
  const OVR = calculateOverall(playerBase);
  const player = {
    ...playerBase,
    OVR,
    marketValue: calculateMarketValue({ ...playerBase, OVR }, nextReputation),
  };

  return {
    ...career,
    player,
    coachTrust: nextCoachTrust,
    reputation: nextReputation,
    form: nextForm,
    condition: nextCondition,
    fatigue: nextFatigue,
    currentEvent: {
      ...event,
      selectedChoiceId: selectedChoice.id,
      resolvedDescription: selectedChoice.description,
    },
  };
}

export function getEventInjuryRisk(event: MonthlyEvent | undefined, selectedChoiceId?: string): number {
  if (!event) {
    return 0;
  }

  const selectedChoice = event.choices.find((candidate) => candidate.id === selectedChoiceId) ?? event.choices[0];
  return selectedChoice.effect.injuryRisk ?? 0;
}
