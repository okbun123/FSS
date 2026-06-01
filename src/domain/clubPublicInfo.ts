import type { Club, ClubTrainingFacilities, NonPlayableClub, PublicClubStars } from "./types";

export interface PublicClubInfoItem {
  label: "평판" | "전력" | "예산" | "유스 기회" | "훈련 시설";
  value: string;
}

export function toStarRating(value: number): number {
  if (value <= 39) {
    return 1;
  }
  if (value <= 54) {
    return 2;
  }
  if (value <= 69) {
    return 3;
  }
  if (value <= 84) {
    return 4;
  }
  return 5;
}

export function averageTrainingFacilities(facilities: ClubTrainingFacilities): number {
  const values = Object.values(facilities);
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function getPublicClubStars(club: Club): PublicClubStars {
  return {
    reputationStars: toStarRating(club.reputation),
    squadStrengthStars: toStarRating(club.squadStrength),
    budgetStars: toStarRating(club.budgetLevel),
    youthOpportunityStars: toStarRating(club.youthOpportunity),
    trainingFacilityStars: toStarRating(averageTrainingFacilities(club.trainingFacilities)),
  };
}

export function starsToInternalValue(stars: number): number {
  const clamped = Math.max(1, Math.min(5, Math.round(stars)));
  return [30, 47, 62, 77, 88][clamped - 1];
}

export function getNonPlayableClubStars(club: NonPlayableClub): PublicClubStars {
  return {
    reputationStars: club.reputationStars,
    squadStrengthStars: club.squadStrengthStars,
    budgetStars: club.budgetStars,
    youthOpportunityStars: club.youthOpportunityStars,
    trainingFacilityStars: club.trainingFacilityStars,
  };
}

export function formatStars(stars: number): string {
  return "★".repeat(Math.max(1, Math.min(5, stars))) + "☆".repeat(Math.max(0, 5 - stars));
}

export function formatInternalClubValueAsStars(value: number): string {
  return formatStars(toStarRating(value));
}

export function getVisibleClubInfoItems(club: Club): PublicClubInfoItem[] {
  const stars = getPublicClubStars(club);

  return [
    { label: "평판", value: formatStars(stars.reputationStars) },
    { label: "전력", value: formatStars(stars.squadStrengthStars) },
    { label: "예산", value: formatStars(stars.budgetStars) },
    { label: "유스 기회", value: formatStars(stars.youthOpportunityStars) },
    { label: "훈련 시설", value: formatStars(stars.trainingFacilityStars) },
  ];
}
