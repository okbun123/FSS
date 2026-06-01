import type { Club, LeagueMovementRule } from "./types";

export interface PromotionEligibilityResult {
  eligible: boolean;
  reasons: string[];
}

export function isLicenseEligible(club?: Pick<Club, "licenseEligible">): boolean {
  return club?.licenseEligible !== false;
}

export function hasPromotionIntent(club?: Pick<Club, "promotionIntent">): boolean {
  return club?.promotionIntent !== false;
}

export function checkPromotionEligibility(
  club: Pick<Club, "licenseEligible" | "promotionIntent"> | undefined,
  rule: Pick<LeagueMovementRule, "licensingRequired" | "promotionIntentRequired">,
): PromotionEligibilityResult {
  const reasons: string[] = [];

  if (rule.licensingRequired && !isLicenseEligible(club)) {
    reasons.push("license");
  }

  if (rule.promotionIntentRequired && !hasPromotionIntent(club)) {
    reasons.push("promotionIntent");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}
