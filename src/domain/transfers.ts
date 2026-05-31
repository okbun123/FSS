import {
  getAllClubs,
  getClubById,
  getLeagueName,
} from "../data/fictionalLeagues";
import { calculateMarketValue, calculateOverall } from "../game/overall";
import { createUnifiedFeedForCareer } from "./feed";
import {
  createInitialNegotiation,
  negotiateTransferOffer,
  type TransferNegotiationAction,
  type TransferNegotiationOutcome,
} from "./negotiation";
import type {
  CareerEventLogEntry,
  CareerHistoryEntry,
  CareerState,
  Club,
  ContractTerms,
  TransferOffer,
} from "./types";

const EVENT_LOG_LIMIT = 80;
const OFFER_LIMIT = 8;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function roundToNearest(value: number, unit: number): number {
  return Math.round(value / unit) * unit;
}

function getCurrentClub(career: CareerState): Club {
  const club = career.clubs[career.player.clubId] ?? getClubById(career.player.clubId);

  if (!club) {
    throw new Error(`Unknown current club: ${career.player.clubId}`);
  }

  return club;
}

function getOffer(career: CareerState, offerId: string): TransferOffer {
  const offer = career.transferOffers.find((candidate) => candidate.id === offerId);

  if (!offer) {
    throw new Error(`Unknown transfer offer: ${offerId}`);
  }

  return offer;
}

function syncOfferTerms(offer: TransferOffer, terms: ContractTerms): TransferOffer {
  return {
    ...offer,
    salary: terms.salary,
    squadRole: terms.squadRole,
    contractTerms: terms,
    negotiation: {
      ...offer.negotiation,
      currentTerms: terms,
    },
  };
}

function updateOffer(career: CareerState, offer: TransferOffer): CareerState {
  const transferOffers = career.transferOffers.map((candidate) =>
    candidate.id === offer.id ? syncOfferTerms(offer, offer.negotiation.currentTerms) : candidate,
  );

  return {
    ...career,
    transferOffers,
    unifiedFeed: createUnifiedFeedForCareer({
      ...career,
      transferOffers,
    }),
  };
}

function createTransferLogEntry(input: {
  career: CareerState;
  offer: TransferOffer;
  type: CareerEventLogEntry["type"];
  title: string;
  description: string;
  idSuffix: string;
  createdAt: string;
}): CareerEventLogEntry {
  return {
    id: `season-${input.career.season.number}-month-${input.career.season.currentMonth}-${input.idSuffix}`,
    seasonNumber: input.career.season.number,
    month: input.career.season.currentMonth,
    type: input.type,
    title: input.title,
    description: input.description,
    createdAt: input.createdAt,
  };
}

function withTransferLog(career: CareerState, entry: CareerEventLogEntry): CareerState {
  const nextCareer = {
    ...career,
    eventLog: [...career.eventLog, entry].slice(-EVENT_LOG_LIMIT),
  };

  return {
    ...nextCareer,
    unifiedFeed: createUnifiedFeedForCareer(nextCareer),
  };
}

function withSyncedPlayerMetrics(career: CareerState): CareerState {
  const selectedPosition = career.player.selectedPosition ?? career.player.position;
  const playerBase = {
    ...career.player,
    selectedPosition,
    position: selectedPosition,
    form: career.form,
    condition: career.condition,
    fatigue: career.fatigue,
    reputation: career.reputation,
    coachTrust: career.coachTrust,
  };
  const OVR = calculateOverall(playerBase, selectedPosition);

  return {
    ...career,
    player: {
      ...playerBase,
      OVR,
      marketValue: calculateMarketValue({ ...playerBase, OVR }, career.reputation),
    },
  };
}

function getLeaguePosition(career: CareerState, club: Club): number {
  return career.season.tables[club.leagueId]?.find((row) => row.clubId === club.id)?.position ?? 0;
}

function createTransferHistoryEntry(career: CareerState, currentClub: Club, offer: TransferOffer): CareerHistoryEntry {
  const league = career.leagues[currentClub.leagueId];

  return {
    id: `transfer-${offer.id}`,
    seasonNumber: career.season.number,
    year: career.season.year,
    clubId: currentClub.id,
    clubName: currentClub.name,
    leagueName: league?.name ?? getLeagueName(currentClub.leagueId),
    appearances: career.seasonStats.appearances,
    goals: career.seasonStats.goals,
    assists: career.seasonStats.assists,
    averageRating: career.seasonStats.averageRating,
    leaguePosition: getLeaguePosition(career, currentClub),
    achievement: `${offer.clubName} 이적`,
  };
}

export function isTransferOfferActionable(offer: TransferOffer): boolean {
  return offer.negotiation.status === "open" || offer.negotiation.status === "countered";
}

export function createTransferOfferForCareer(career: CareerState): TransferOffer | undefined {
  const month = career.season.currentMonth;

  if (![6, 12].includes(month) || career.reputation < 42) {
    return undefined;
  }

  const currentClub = getCurrentClub(career);
  const overall = calculateOverall(career.player);
  const candidates = Object.values(career.clubs).length > 0 ? Object.values(career.clubs) : getAllClubs();
  const target = candidates
    .filter((club) => club.id !== currentClub.id)
    .filter((club) => Math.abs(club.squadStrength - overall) <= 12)
    .sort((left, right) => right.reputation - left.reputation)[0];

  if (!target) {
    return undefined;
  }

  const salary = roundToNearest(650 + career.reputation * 18 + overall * 12, 50);
  const contractTerms: ContractTerms = {
    salary,
    contractYears: 3,
    signingBonus: Math.round(salary * 0.35),
    squadRole: target.squadStrength <= overall ? "regular" : "rotation",
    promisedPosition: career.player.selectedPosition,
    releaseClause: target.budgetLevel >= 72 ? roundToNearest(career.player.marketValue * 1.8, 100) : undefined,
    appearanceBonus: Math.round(salary * 0.08),
    goalBonus: Math.round(salary * 0.05),
  };
  const createdAt = new Date(Date.UTC(career.season.year, Math.min(Math.max(month, 1), 12) - 1, 1)).toISOString();
  const transferFee = roundToNearest(career.player.marketValue * (1.05 + target.reputation / 300), 100);

  return {
    id: `season-${career.season.number}-month-${month}-offer-${target.id}`,
    month,
    clubId: target.id,
    clubName: target.name,
    leagueId: target.leagueId,
    squadRole: contractTerms.squadRole,
    salary,
    transferFee,
    createdAt,
    expiresAt: new Date(Date.UTC(career.season.year, Math.min(month + 1, 12) - 1, 1)).toISOString(),
    contractTerms,
    negotiation: createInitialNegotiation(contractTerms, createdAt),
    description: `${target.name}이 다음 이적 시장에서 관심을 보이고 있습니다.`,
  };
}

export function acceptTransferOffer(
  career: CareerState,
  offerId: string,
  acceptedAt = new Date().toISOString(),
): CareerState {
  const offer = getOffer(career, offerId);
  const currentClub = getCurrentClub(career);
  const targetClub = career.clubs[offer.clubId] ?? getClubById(offer.clubId);

  if (!targetClub) {
    throw new Error(`Unknown target club: ${offer.clubId}`);
  }

  const terms = offer.negotiation.currentTerms;
  const acceptedOffer: TransferOffer = {
    ...offer,
    negotiation: {
      ...offer.negotiation,
      status: "accepted",
      lastResponse: "accepted",
      updatedAt: acceptedAt,
    },
  };
  const reputationDelta = targetClub.reputation >= currentClub.reputation ? 4 : 1;
  const fanSupportDelta = targetClub.reputation >= currentClub.reputation ? -6 : -10;
  const transferOffers = career.transferOffers.map((candidate) => {
    if (candidate.id === offer.id) {
      return acceptedOffer;
    }

    return {
      ...candidate,
      negotiation: {
        ...candidate.negotiation,
        status: "withdrawn" as const,
        lastResponse: "final" as const,
        updatedAt: acceptedAt,
      },
    };
  });
  const nextReputation = clamp(career.reputation + reputationDelta);
  const nextCareer = withSyncedPlayerMetrics({
    ...career,
    player: {
      ...career.player,
      clubId: offer.clubId,
    },
    playerContractStatus: "contracted",
    reputation: nextReputation,
    fanSupport: clamp((career.fanSupport ?? 50) + fanSupportDelta, 10, 95),
    salary: terms.salary,
    contractYearsLeft: terms.contractYears,
    squadRole: terms.squadRole,
    transferOffers,
    careerHistory: [
      ...career.careerHistory,
      createTransferHistoryEntry(career, currentClub, offer),
    ].slice(-16),
  });

  return withTransferLog(
    nextCareer,
    createTransferLogEntry({
      career,
      offer,
      type: "transfer_completed",
      title: "이적 완료",
      description: `${currentClub.name}에서 ${offer.clubName}(으)로 이적했습니다. 연봉 ${terms.salary.toLocaleString("ko-KR")}만, ${terms.contractYears}년 계약입니다.`,
      idSuffix: `transfer-accepted-${offer.id}`,
      createdAt: acceptedAt,
    }),
  );
}

export function rejectTransferOffer(
  career: CareerState,
  offerId: string,
  rejectedAt = new Date().toISOString(),
): CareerState {
  const offer = getOffer(career, offerId);
  const rejectedOffer: TransferOffer = {
    ...offer,
    negotiation: {
      ...offer.negotiation,
      status: "rejected",
      lastResponse: "rejected",
      updatedAt: rejectedAt,
    },
  };
  const careerWithOffer = updateOffer(career, rejectedOffer);

  return withTransferLog(
    careerWithOffer,
    createTransferLogEntry({
      career,
      offer,
      type: "transfer_negotiation",
      title: "이적 제안 거절",
      description: `${offer.clubName}의 제안을 거절했습니다.`,
      idSuffix: `transfer-rejected-${offer.id}`,
      createdAt: rejectedAt,
    }),
  );
}

export function holdTransferOffer(
  career: CareerState,
  offerId: string,
  heldAt = new Date().toISOString(),
): CareerState {
  const offer = getOffer(career, offerId);

  return withTransferLog(
    career,
    createTransferLogEntry({
      career,
      offer,
      type: "transfer_negotiation",
      title: "이적 제안 보류",
      description: `${offer.clubName}의 제안을 보류하고 추이를 지켜보기로 했습니다.`,
      idSuffix: `transfer-held-${offer.id}`,
      createdAt: heldAt,
    }),
  );
}

export interface TransferCareerNegotiationOutcome extends Omit<TransferNegotiationOutcome, "offer"> {
  career: CareerState;
  offer: TransferOffer;
}

export function applyTransferNegotiationAction(
  career: CareerState,
  offerId: string,
  action: TransferNegotiationAction,
  updatedAt = new Date().toISOString(),
): TransferCareerNegotiationOutcome {
  if (action === "accept") {
    const nextCareer = acceptTransferOffer(career, offerId, updatedAt);
    const offer = getOffer(nextCareer, offerId);

    return {
      career: nextCareer,
      offer,
      result: "player_accepts",
      message: `${offer.clubName}의 제안을 수락했습니다.`,
    };
  }

  if (action === "reject") {
    const nextCareer = rejectTransferOffer(career, offerId, updatedAt);
    const offer = getOffer(nextCareer, offerId);

    return {
      career: nextCareer,
      offer,
      result: "player_rejects",
      message: `${offer.clubName}의 제안을 거절했습니다.`,
    };
  }

  const offer = getOffer(career, offerId);
  const outcome = negotiateTransferOffer(offer, action, updatedAt);
  const careerWithOffer = updateOffer(career, outcome.offer);
  const careerWithLog = withTransferLog(
    careerWithOffer,
    createTransferLogEntry({
      career,
      offer: outcome.offer,
      type: "transfer_negotiation",
      title: "이적 협상 진행",
      description: outcome.message,
      idSuffix: `transfer-negotiation-${offer.id}-${outcome.offer.negotiation.round}`,
      createdAt: updatedAt,
    }),
  );

  return {
    career: careerWithLog,
    offer: outcome.offer,
    result: outcome.result,
    message: outcome.message,
  };
}

export function addTransferOfferToCareer(career: CareerState, offer: TransferOffer): CareerState {
  const transferOffers = career.transferOffers.some((candidate) => candidate.id === offer.id)
    ? career.transferOffers
    : [...career.transferOffers, offer].slice(-OFFER_LIMIT);
  const nextCareer = {
    ...career,
    transferOffers,
  };

  return {
    ...nextCareer,
    unifiedFeed: createUnifiedFeedForCareer(nextCareer),
  };
}
