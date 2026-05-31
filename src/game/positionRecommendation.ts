import { calculatePositionRecommendations as calculateDomainPositionRecommendations } from "../domain/positionRecommendation";
import type { Footedness, Player, PositionRecommendation } from "../domain/types";

export {
  POSITION_FIT_WEIGHTS,
  type PositionFitAttribute,
} from "../domain/positionRecommendation";

export type RecommendationProfile = Pick<
  Player,
  "attributes" | "leftFoot" | "rightFoot" | "potential"
> & {
  dominantFoot?: Footedness;
};

function getDominantFoot(profile: RecommendationProfile): Footedness {
  if (profile.dominantFoot) {
    return profile.dominantFoot;
  }

  if (profile.leftFoot === 20 && profile.rightFoot === 20) {
    return "both";
  }

  return profile.leftFoot === 20 ? "left" : "right";
}

function createRecommendationPlayer(profile: RecommendationProfile): Player {
  return {
    id: "recommendation-preview",
    name: "추천 선수",
    nationality: "대한민국",
    age: 18,
    selectedPosition: "ST",
    recommendedPositions: [],
    dominantFoot: getDominantFoot(profile),
    OVR: 1,
    form: 50,
    condition: 80,
    fatigue: 10,
    reputation: 20,
    coachTrust: 40,
    marketValue: 0,
    position: "ST",
    personality: "diligent",
    clubId: "preview",
    potential: profile.potential,
    leftFoot: profile.leftFoot,
    rightFoot: profile.rightFoot,
    attributes: profile.attributes,
  };
}

export function calculatePositionRecommendations(
  player: Player | RecommendationProfile,
): PositionRecommendation[] {
  return calculateDomainPositionRecommendations(createRecommendationPlayer(player));
}

export function recommendPositions(profile: Player | RecommendationProfile): PositionRecommendation[] {
  return calculatePositionRecommendations(profile).slice(0, 3);
}
