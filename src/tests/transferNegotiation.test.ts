import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { TransferOfferCard } from "../components/career/TransferOfferCard";
import { STARTER_CLUBS } from "../data/fictionalLeagues";
import {
  acceptTransferOffer,
  addTransferOfferToCareer,
  applyTransferNegotiationAction,
  createTransferOfferForCareer,
  rejectTransferOffer,
} from "../domain/transfers";
import type { CareerState, TransferOffer } from "../domain/types";
import { createNewCareer } from "../game/monthlyCareer";
import { generatePlayerRoll } from "../game/playerGeneration";

function createCareer() {
  const roll = generatePlayerRoll("transfer-negotiation");
  const career = createNewCareer({
    name: "협상 테스트",
    nationality: "대한민국",
    clubId: STARTER_CLUBS[0].id,
    position: roll.recommendations[0].position,
    roll,
  });

  return {
    ...career,
    reputation: 62,
    fanSupport: 58,
    season: {
      ...career.season,
      currentMonth: 6,
    },
    player: {
      ...career.player,
      reputation: 62,
    },
  };
}

function createCareerWithOffer(): { career: CareerState; offer: TransferOffer } {
  const career = createCareer();
  const offer = createTransferOfferForCareer(career);

  if (!offer) {
    throw new Error("Expected a deterministic transfer offer for negotiation tests.");
  }

  return {
    career: addTransferOfferToCareer(career, offer),
    offer,
  };
}

function textFrom(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(textFrom).join("");
  }

  if (isValidElement(node)) {
    return textFrom((node.props as { children?: ReactNode }).children);
  }

  return "";
}

function findButtonByText(node: ReactNode, text: string): ReactElement<{ onClick: () => void }> | undefined {
  if (!isValidElement(node)) {
    return undefined;
  }

  if (node.type === "button" && textFrom((node.props as { children?: ReactNode }).children).includes(text)) {
    return node as ReactElement<{ onClick: () => void }>;
  }

  const children = (node.props as { children?: ReactNode }).children;
  const childList = Array.isArray(children) ? children : [children];

  for (const child of childList) {
    const match = findButtonByText(child, text);

    if (match) {
      return match;
    }
  }

  return undefined;
}

describe("transfer negotiation", () => {
  it("creates a transfer offer feed item", () => {
    const { career, offer } = createCareerWithOffer();
    const item = career.unifiedFeed.find((feedItem) => feedItem.relatedEntityId === offer.id);

    expect(item?.type).toBe("transfer_offer");
    expect(item?.title).toContain(offer.clubName);
    expect(item?.action?.type).toBe("open_transfer_offer");
  });

  it("clicking negotiate opens negotiation state through the card callback", () => {
    const { offer } = createCareerWithOffer();
    let openedOfferId: string | null = null;
    const element = TransferOfferCard({
      offer,
      onNegotiate: (offerId) => {
        openedOfferId = offerId;
      },
      onAccept: () => undefined,
      onReject: () => undefined,
      onHold: () => undefined,
    });
    const negotiateButton = findButtonByText(element, "협상");

    expect(negotiateButton).toBeDefined();
    negotiateButton?.props.onClick();

    expect(openedOfferId).toBe(offer.id);
  });

  it("accepting an offer changes club, contract, support, history, and feed log", () => {
    const { career, offer } = createCareerWithOffer();
    const previousClubId = career.player.clubId;
    const accepted = acceptTransferOffer(career, offer.id, "2027-06-10T00:00:00.000Z");
    const acceptedOffer = accepted.transferOffers.find((candidate) => candidate.id === offer.id);

    expect(accepted.player.clubId).toBe(offer.clubId);
    expect(accepted.player.clubId).not.toBe(previousClubId);
    expect(accepted.salary).toBe(offer.contractTerms.salary);
    expect(accepted.contractYearsLeft).toBe(offer.contractTerms.contractYears);
    expect(accepted.squadRole).toBe(offer.contractTerms.squadRole);
    expect(accepted.reputation).not.toBe(career.reputation);
    expect(accepted.fanSupport).not.toBe(career.fanSupport);
    expect(accepted.careerHistory.some((entry) => entry.id === `transfer-${offer.id}`)).toBe(true);
    expect(accepted.eventLog.some((entry) => entry.type === "transfer_completed")).toBe(true);
    expect(accepted.unifiedFeed.some((item) => item.type === "log" && item.title === "이적 완료")).toBe(true);
    expect(acceptedOffer?.negotiation.status).toBe("accepted");
  });

  it("rejecting an offer marks it rejected and removes its actions", () => {
    const { career, offer } = createCareerWithOffer();
    const rejected = rejectTransferOffer(career, offer.id, "2027-06-10T00:00:00.000Z");
    const rejectedOffer = rejected.transferOffers.find((candidate) => candidate.id === offer.id);
    const feedItem = rejected.unifiedFeed.find((item) => item.relatedEntityId === offer.id);

    expect(rejectedOffer?.negotiation.status).toBe("rejected");
    expect(feedItem?.action).toBeUndefined();
  });

  it("counteroffer updates the active terms", () => {
    const { career, offer } = createCareerWithOffer();
    const outcome = applyTransferNegotiationAction(
      career,
      offer.id,
      "salary_raise",
      "2027-06-10T00:00:00.000Z",
    );
    const updatedOffer = outcome.career.transferOffers.find((candidate) => candidate.id === offer.id);

    expect(outcome.result).toBe("club_counters");
    expect(updatedOffer?.negotiation.status).toBe("countered");
    expect(updatedOffer?.negotiation.currentTerms.salary).toBeGreaterThan(offer.contractTerms.salary);
    expect(outcome.career.eventLog.some((entry) => entry.type === "transfer_negotiation")).toBe(true);
  });
});
