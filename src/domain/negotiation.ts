import type { ContractTerms, NegotiationState, SquadRole, TransferOffer } from "./types";

export type TransferNegotiationAction =
  | "salary_raise"
  | "playing_time"
  | "contract_length"
  | "release_clause"
  | "accept"
  | "reject";

export type TransferNegotiationResult =
  | "club_accepts"
  | "club_counters"
  | "club_refuses_offer_remains"
  | "club_withdraws_offer"
  | "player_accepts"
  | "player_rejects";

export interface TransferNegotiationOutcome {
  offer: TransferOffer;
  result: TransferNegotiationResult;
  message: string;
}

const ROLE_ORDER: SquadRole[] = ["prospect", "rotation", "regular", "keyPlayer"];

function roundToNearest(value: number, unit: number): number {
  return Math.round(value / unit) * unit;
}

function nextRole(role: SquadRole): SquadRole {
  const index = ROLE_ORDER.indexOf(role);
  return ROLE_ORDER[Math.min(index + 1, ROLE_ORDER.length - 1)];
}

export function createInitialNegotiation(terms: ContractTerms, createdAt: string): NegotiationState {
  return {
    status: "open",
    round: 0,
    maxRounds: 3,
    currentTerms: terms,
    lastResponse: "waiting",
    updatedAt: createdAt,
  };
}

function withTerms(
  offer: TransferOffer,
  terms: ContractTerms,
  negotiation: Omit<Partial<NegotiationState>, "currentTerms">,
): TransferOffer {
  const nextNegotiation = {
    ...offer.negotiation,
    ...negotiation,
    currentTerms: terms,
  };

  return {
    ...offer,
    salary: terms.salary,
    squadRole: terms.squadRole,
    contractTerms: terms,
    negotiation: nextNegotiation,
  };
}

function closeOffer(
  offer: TransferOffer,
  status: NegotiationState["status"],
  updatedAt: string,
  lastResponse: NegotiationState["lastResponse"],
): TransferOffer {
  return {
    ...offer,
    negotiation: {
      ...offer.negotiation,
      status,
      lastResponse,
      updatedAt,
    },
  };
}

export function negotiateTransferOffer(
  offer: TransferOffer,
  action: TransferNegotiationAction,
  updatedAt = new Date().toISOString(),
): TransferNegotiationOutcome {
  const round = offer.negotiation.round + 1;
  const currentTerms = offer.negotiation.currentTerms;

  if (action === "accept") {
    return {
      offer: closeOffer(offer, "accepted", updatedAt, "accepted"),
      result: "player_accepts",
      message: `${offer.clubName}의 제안을 수락했습니다.`,
    };
  }

  if (action === "reject") {
    return {
      offer: closeOffer(offer, "rejected", updatedAt, "rejected"),
      result: "player_rejects",
      message: `${offer.clubName}의 제안을 거절했습니다.`,
    };
  }

  if (round > offer.negotiation.maxRounds) {
    return {
      offer: closeOffer(offer, "withdrawn", updatedAt, "final"),
      result: "club_withdraws_offer",
      message: `${offer.clubName}이 추가 협상을 중단하고 제안을 철회했습니다.`,
    };
  }

  if (action === "salary_raise") {
    const playerCounterTerms = {
      ...currentTerms,
      salary: roundToNearest(currentTerms.salary * 1.14, 50),
    };
    const counterTerms = {
      ...currentTerms,
      salary: roundToNearest(currentTerms.salary * 1.07, 50),
    };

    return {
      offer: withTerms(offer, counterTerms, {
        status: "countered",
        round,
        playerCounterTerms,
        lastResponse: "improved",
        updatedAt,
      }),
      result: "club_counters",
      message: `${offer.clubName}이 연봉을 ${counterTerms.salary.toLocaleString("ko-KR")}만으로 역제안했습니다.`,
    };
  }

  if (action === "playing_time") {
    const upgradedRole = nextRole(currentTerms.squadRole);

    if (upgradedRole === currentTerms.squadRole) {
      return {
        offer: {
          ...offer,
          negotiation: {
            ...offer.negotiation,
            round,
            playerCounterTerms: currentTerms,
            lastResponse: "rejected",
            updatedAt,
          },
        },
        result: "club_refuses_offer_remains",
        message: `${offer.clubName}은 이미 가능한 최고 역할을 제시했다고 답했습니다.`,
      };
    }

    const acceptedTerms = {
      ...currentTerms,
      squadRole: upgradedRole,
      promisedPosition: currentTerms.promisedPosition ?? undefined,
    };

    return {
      offer: withTerms(offer, acceptedTerms, {
        status: "countered",
        round,
        playerCounterTerms: acceptedTerms,
        lastResponse: "accepted",
        updatedAt,
      }),
      result: "club_accepts",
      message: `${offer.clubName}이 출전 시간 보장 요구를 받아들였습니다.`,
    };
  }

  if (action === "contract_length") {
    const requestedYears = Math.min(currentTerms.contractYears + 1, 5);
    const counterYears = requestedYears >= 5 ? 4 : requestedYears;
    const playerCounterTerms = {
      ...currentTerms,
      contractYears: requestedYears,
    };
    const counterTerms = {
      ...currentTerms,
      contractYears: counterYears,
    };

    return {
      offer: withTerms(offer, counterTerms, {
        status: "countered",
        round,
        playerCounterTerms,
        lastResponse: counterYears === requestedYears ? "accepted" : "improved",
        updatedAt,
      }),
      result: counterYears === requestedYears ? "club_accepts" : "club_counters",
      message:
        counterYears === requestedYears
          ? `${offer.clubName}이 계약 기간 조정을 받아들였습니다.`
          : `${offer.clubName}이 ${counterYears}년 계약으로 역제안했습니다.`,
    };
  }

  if (action === "release_clause") {
    if (round >= offer.negotiation.maxRounds && currentTerms.releaseClause) {
      return {
        offer: closeOffer(offer, "withdrawn", updatedAt, "final"),
        result: "club_withdraws_offer",
        message: `${offer.clubName}이 바이아웃 재협상을 거부하고 제안을 철회했습니다.`,
      };
    }

    if (currentTerms.releaseClause) {
      return {
        offer: {
          ...offer,
          negotiation: {
            ...offer.negotiation,
            round,
            playerCounterTerms: currentTerms,
            lastResponse: "rejected",
            updatedAt,
          },
        },
        result: "club_refuses_offer_remains",
        message: `${offer.clubName}은 기존 바이아웃 조건을 유지하겠다고 답했습니다.`,
      };
    }

    const acceptedTerms = {
      ...currentTerms,
      releaseClause: roundToNearest(currentTerms.salary * 80, 100),
    };

    return {
      offer: withTerms(offer, acceptedTerms, {
        status: "countered",
        round,
        playerCounterTerms: acceptedTerms,
        lastResponse: "accepted",
        updatedAt,
      }),
      result: "club_accepts",
      message: `${offer.clubName}이 바이아웃 삽입 요구를 받아들였습니다.`,
    };
  }

  return {
    offer,
    result: "club_refuses_offer_remains",
    message: "협상 요청을 처리하지 못했습니다.",
  };
}
