import { calculateOverall } from "../game/overall";
import { getPublicClubStars } from "./clubPublicInfo";
import type { Attributes, Club, League, Player, Position, PublicClubStars } from "./types";

export type TeamFitRole = "bench" | "rotation" | "starter";
export type TeamFitBand = "poor" | "weak" | "average" | "good" | "excellent";

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
  band: TeamFitBand;
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

export function getTeamFitBand(score: number): TeamFitBand {
  const normalizedScore = clamp(score);

  if (normalizedScore >= 85) {
    return "excellent";
  }
  if (normalizedScore >= 70) {
    return "good";
  }
  if (normalizedScore >= 55) {
    return "average";
  }
  if (normalizedScore >= 40) {
    return "weak";
  }
  return "poor";
}

function getLeaguePressure(league: League): number {
  return (5 - league.level) * 1.5;
}

function getYouthRoleAdjustment(club: Club, league: League): number {
  const youthBase = club.youthOpportunity >= 84 ? 8 : club.youthOpportunity >= 74 ? 5 : club.youthOpportunity >= 64 ? 2 : 0;
  const lowerClubBonus = league.level >= 4 ? 3 : league.level >= 3 ? 2 : league.level >= 2 ? 1 : 0;

  return youthBase + lowerClubBonus;
}

function getClubPositionLevel(club: Club, league: League, position: Position): number {
  const positionDepth = getDepthValue(club, position);
  const rawLevel = club.squadStrength * 0.5 + positionDepth * 0.28 + club.reputation * 0.14 + getLeaguePressure(league);

  return rawLevel - getYouthRoleAdjustment(club, league);
}

function getRole(playerOverall: number, club: Club, league: League, position: Position): TeamFitRole {
  const roleScore = playerOverall - getClubPositionLevel(club, league, position);

  if (roleScore >= 0) {
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
  const role = getRole(playerOverall, club, league, selectedPosition);
  const leagueAccessibility = league.level * 3.5;
  const clubPositionLevel = getClubPositionLevel(club, league, selectedPosition);
  const strengthFit = 100 - Math.abs(playerOverall - clubPositionLevel) * 3;
  const youthFit = club.youthOpportunity * 0.26;
  const reputationFit = club.reputation * 0.14;
  const facilityFit = average(Object.values(club.trainingFacilities)) * 0.16;
  const depthOpportunity = 100 - getDepthValue(club, selectedPosition);
  const roleBonus = role === "starter" ? 12 : role === "rotation" ? 7 : 0;
  const score = Math.round(
    clamp(
      strengthFit * 0.36 +
        youthFit +
        reputationFit +
        facilityFit +
        depthOpportunity * 0.12 +
        leagueAccessibility +
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
    band: getTeamFitBand(score),
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
