import type {
  CareerEventLogEntry,
  CareerState,
  Club,
  ContractOffer,
  ContractOfferType,
  Position,
  SquadRole,
} from "../domain/types";

export const SQUAD_ROLE_LABELS: Record<SquadRole, string> = {
  prospect: "유망주",
  rotation: "로테이션",
  regular: "주전 경쟁",
  keyPlayer: "핵심 선수",
};

export const OFFER_TYPE_LABELS: Record<ContractOfferType, string> = {
  stay: "잔류 제안",
  strongerLowerPlayingTime: "상위 클럽 도전",
  weakerHigherPlayingTime: "출전 시간 확보",
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function roundSalary(value: number): number {
  return Math.round(value / 50) * 50;
}

function getPositionDemand(position: Position): number {
  if (position === "ST" || position === "LW" || position === "RW" || position === "AM") {
    return 5;
  }

  if (position === "CM" || position === "DM") {
    return 3;
  }

  return 2;
}

function getOfferScore(career: CareerState): number {
  const stats = career.seasonStats;
  const ratingScore = stats.averageRating * 14;
  const ageScore = career.player.age <= 19 ? 10 : career.player.age <= 22 ? 6 : 2;
  const reputationScore = career.reputation * 0.55;
  const trustScore = career.coachTrust * 0.35;
  const productionScore =
    stats.goals * 2 + stats.assists * 1.8 + stats.keyMomentsWon * 0.25;
  const positionScore = getPositionDemand(career.player.position);

  return ratingScore + ageScore + reputationScore + trustScore + productionScore + positionScore;
}

function getBaseSalary(career: CareerState, offerScore: number): number {
  const stats = career.seasonStats;

  return roundSalary(
    450 +
      offerScore * 10 +
      career.reputation * 12 +
      stats.goals * 35 +
      stats.assists * 28 +
      getPositionDemand(career.player.position) * 25,
  );
}

function lowerRole(role: SquadRole): SquadRole {
  if (role === "keyPlayer") {
    return "regular";
  }

  if (role === "regular") {
    return "rotation";
  }

  return "prospect";
}

function higherRole(role: SquadRole): SquadRole {
  if (role === "prospect") {
    return "rotation";
  }

  if (role === "rotation") {
    return "regular";
  }

  return "keyPlayer";
}

function getStayRole(career: CareerState, offerScore: number): SquadRole {
  if (offerScore >= 145) {
    return higherRole(career.squadRole);
  }

  return career.squadRole;
}

function findStrongerClub(career: CareerState): Club | undefined {
  const currentClub = career.league.clubs.find((club) => club.id === career.player.clubId);
  const currentStrength = currentClub?.strength ?? 60;

  return career.league.clubs
    .filter((club) => club.id !== career.player.clubId && club.strength > currentStrength)
    .sort((left, right) => left.strength - right.strength)[0];
}

function findWeakerClub(career: CareerState): Club | undefined {
  const currentClub = career.league.clubs.find((club) => club.id === career.player.clubId);
  const currentStrength = currentClub?.strength ?? 60;

  return career.league.clubs
    .filter((club) => club.id !== career.player.clubId && club.strength < currentStrength)
    .sort((left, right) => right.strength - left.strength)[0];
}

function createOffer(
  career: CareerState,
  type: ContractOfferType,
  club: Club,
  salary: number,
  contractYears: number,
  squadRole: SquadRole,
  fanSupportChange: number,
  description: string,
): ContractOffer {
  return {
    id: `season-${career.season.number}-${type}-${club.id}`,
    type,
    clubId: club.id,
    clubName: club.name,
    salary: roundSalary(salary),
    contractYears,
    squadRole,
    fanSupportChange,
    description,
  };
}

export function generateContractOffers(career: CareerState): ContractOffer[] {
  const offerScore = getOfferScore(career);
  const baseSalary = getBaseSalary(career, offerScore);
  const currentClub = career.league.clubs.find((club) => club.id === career.player.clubId);
  const offers: ContractOffer[] = [];

  if (currentClub && offerScore >= 95) {
    offers.push(
      createOffer(
        career,
        "stay",
        currentClub,
        Math.max(career.salary * 1.05, baseSalary * 0.95),
        offerScore >= 145 ? 3 : 2,
        getStayRole(career, offerScore),
        4,
        "현재 클럽이 익숙한 환경과 안정적인 출전 기회를 제안했습니다.",
      ),
    );
  }

  const strongerClub = findStrongerClub(career);
  if (strongerClub && offerScore >= 130) {
    offers.push(
      createOffer(
        career,
        "strongerLowerPlayingTime",
        strongerClub,
        baseSalary * 1.18,
        3,
        lowerRole(career.squadRole),
        -8,
        "더 강한 클럽에서 경쟁하지만 출전 시간은 줄어들 수 있습니다.",
      ),
    );
  }

  const weakerClub = findWeakerClub(career);
  if (weakerClub && offerScore >= 85) {
    offers.push(
      createOffer(
        career,
        "weakerHigherPlayingTime",
        weakerClub,
        baseSalary * 0.86,
        2,
        higherRole(career.squadRole),
        -3,
        "한 단계 낮은 클럽에서 더 큰 역할과 출전 시간을 제안했습니다.",
      ),
    );
  }

  return offers.slice(0, 3);
}

export function getSeasonContractOffers(career: CareerState): ContractOffer[] {
  return career.seasonOffers.length > 0
    ? career.seasonOffers
    : generateContractOffers(career);
}

function createContractEvent(
  career: CareerState,
  title: string,
  description: string,
): CareerEventLogEntry {
  return {
    id: `season-${career.season.number}-contract-${career.eventLog.length + 1}`,
    week: career.currentWeek,
    title,
    description,
    createdAt: new Date().toISOString(),
  };
}

function withStoredOffers(career: CareerState, offers: ContractOffer[]): CareerState {
  return career.seasonOffers.length > 0 ? career : { ...career, seasonOffers: offers };
}

export function acceptContractOffer(
  career: CareerState,
  offerId: string,
): CareerState {
  const offers = getSeasonContractOffers(career);
  const offer = offers.find((candidate) => candidate.id === offerId);

  if (!offer) {
    throw new Error(`Unknown contract offer: ${offerId}`);
  }

  const careerWithOffers = withStoredOffers(career, offers);

  return {
    ...careerWithOffers,
    player: {
      ...careerWithOffers.player,
      clubId: offer.clubId,
    },
    salary: offer.salary,
    contractYearsLeft: offer.contractYears,
    squadRole: offer.squadRole,
    fanSupport: clamp(careerWithOffers.fanSupport + offer.fanSupportChange),
    acceptedContractOfferId: offer.id,
    eventLog: [
      ...careerWithOffers.eventLog,
      createContractEvent(
        careerWithOffers,
        "계약 제안 수락",
        `${offer.clubName} 제안을 수락했습니다. 역할은 ${SQUAD_ROLE_LABELS[offer.squadRole]}입니다.`,
      ),
    ].slice(-30),
  };
}

export function rejectContractOffer(
  career: CareerState,
  offerId: string,
): CareerState {
  const offers = getSeasonContractOffers(career);
  const offer = offers.find((candidate) => candidate.id === offerId);

  if (!offer) {
    throw new Error(`Unknown contract offer: ${offerId}`);
  }

  const careerWithOffers = withStoredOffers(career, offers);

  return {
    ...careerWithOffers,
    rejectedContractOfferIds: [
      ...new Set([...careerWithOffers.rejectedContractOfferIds, offer.id]),
    ],
    eventLog: [
      ...careerWithOffers.eventLog,
      createContractEvent(
        careerWithOffers,
        "계약 제안 거절",
        `${offer.clubName} 제안을 거절했습니다.`,
      ),
    ].slice(-30),
  };
}
