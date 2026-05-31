import { calculateOverall } from "../game/overall";
import { getPublicClubStars } from "./clubPublicInfo";
import type { Attributes, Club, League, Player, Position, PublicClubStars } from "./types";

export type TeamFitRole = "bench" | "rotation" | "starter";

export const TEAM_FIT_ROLE_LABELS: Record<TeamFitRole, string> = {
  bench: "벤치",
  rotation: "로테이션",
  starter: "주전",
};

export interface TeamFitInput {
  club: Club;
  league: League;
  playerOverall: number;
  selectedPosition: Position;
}

export interface TeamFitResult extends PublicClubStars {
  clubId: string;
  score: number;
  role: TeamFitRole;
  band: "poor" | "average" | "good";
  reason: string;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
}

function getDepthValue(club: Club, position: Position): number {
  return club.positionDepth?.[position] ?? club.squadSummary.depth;
}

function getRole(playerOverall: number, club: Club, position: Position): TeamFitRole {
  const positionDepth = getDepthValue(club, position);
  const strengthGap = playerOverall - club.squadStrength;
  const opportunityBonus = club.youthOpportunity >= 75 ? 2 : 0;
  const depthPenalty = positionDepth >= 78 ? 4 : positionDepth >= 62 ? 2 : 0;
  const roleScore = strengthGap + opportunityBonus - depthPenalty;

  if (roleScore >= 2) {
    return "starter";
  }
  if (roleScore >= -8) {
    return "rotation";
  }
  return "bench";
}

export function calculateTeamFit(input: TeamFitInput): TeamFitResult {
  const { club, league, playerOverall, selectedPosition } = input;
  const stars = getPublicClubStars(club);
  const role = getRole(playerOverall, club, selectedPosition);
  const leagueOpportunity = (5 - league.level) * 3;
  const strengthFit = 100 - Math.abs(playerOverall - club.squadStrength) * 2.4;
  const youthFit = club.youthOpportunity * 0.5;
  const reputationFit = club.reputation * 0.18;
  const facilityFit = average(Object.values(club.trainingFacilities)) * 0.12;
  const depthOpportunity = 100 - getDepthValue(club, selectedPosition);
  const roleBonus = role === "starter" ? 12 : role === "rotation" ? 6 : 0;
  const score = Math.round(
    clamp(
      strengthFit * 0.42 +
        youthFit +
        reputationFit +
        facilityFit +
        depthOpportunity * 0.16 +
        leagueOpportunity +
        roleBonus,
      1,
      100,
    ),
  );

  return {
    clubId: club.id,
    ...stars,
    score,
    role,
    band: score >= 72 ? "good" : score >= 48 ? "average" : "poor",
    reason:
      role === "starter"
        ? "현재 전력 대비 즉시 출전 가능성이 높습니다."
        : role === "rotation"
          ? "성장 기회와 출전 경쟁이 균형적입니다."
          : "선수층 경쟁이 강해 초반 출전은 제한적입니다.",
  };
}

export function calculatePreviewOverall(input: {
  attributes: Attributes;
  leftFoot: number;
  rightFoot: number;
  potential: number;
  selectedPosition: Position;
}): number {
  return calculateOverall(
    {
      id: "team-fit-preview",
      name: "미리보기 선수",
      nationality: "대한민국",
      age: 18,
      selectedPosition: input.selectedPosition,
      recommendedPositions: [],
      attributes: input.attributes,
      leftFoot: input.leftFoot,
      rightFoot: input.rightFoot,
      dominantFoot: input.leftFoot === 20 && input.rightFoot === 20 ? "both" : input.leftFoot === 20 ? "left" : "right",
      OVR: 1,
      potential: input.potential,
      form: 50,
      condition: 82,
      fatigue: 10,
      reputation: 20,
      coachTrust: 40,
      marketValue: 0,
      clubId: "preview",
      personality: "diligent",
      position: input.selectedPosition,
    } satisfies Player,
    input.selectedPosition,
  );
}
