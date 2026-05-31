import { describe, expect, it } from "vitest";
import { STARTER_CLUBS } from "../data/clubs";
import type { CareerState } from "../domain/types";
import { createNewCareer } from "../game/career";
import {
  acceptContractOffer,
  generateContractOffers,
  rejectContractOffer,
} from "../game/contracts";

function createCareer(): CareerState {
  return createNewCareer({
    name: "오퍼테스터",
    nationality: "대한민국",
    age: 18,
    preferredFoot: "right",
    position: "ST",
    playStyle: "poacher",
    personality: "ambitious",
    clubId: STARTER_CLUBS[0].id,
  });
}

function createHighValueCareer(): CareerState {
  return {
    ...createCareer(),
    reputation: 52,
    coachTrust: 76,
    fanSupport: 58,
    salary: 1200,
    squadRole: "regular",
    seasonStats: {
      appearances: 14,
      minutesPlayed: 1100,
      goals: 11,
      assists: 7,
      shots: 48,
      keyPasses: 24,
      tackles: 6,
      turnovers: 12,
      averageRating: 7.28,
      keyMomentsWon: 19,
    },
  };
}

describe("generateContractOffers", () => {
  it("creates stay, stronger-club, and weaker-club options for a strong season", () => {
    const career = createHighValueCareer();
    const offers = generateContractOffers(career);
    const currentClub = career.league.clubs.find((club) => club.id === career.player.clubId);
    const strongerOffer = offers.find((offer) => offer.type === "strongerLowerPlayingTime");
    const weakerOffer = offers.find((offer) => offer.type === "weakerHigherPlayingTime");

    expect(offers).toHaveLength(3);
    expect(offers.map((offer) => offer.type)).toEqual([
      "stay",
      "strongerLowerPlayingTime",
      "weakerHigherPlayingTime",
    ]);
    expect(strongerOffer?.squadRole).toBe("rotation");
    expect(weakerOffer?.squadRole).toBe("keyPlayer");
    expect(
      career.league.clubs.find((club) => club.id === strongerOffer?.clubId)?.strength,
    ).toBeGreaterThan(currentClub?.strength ?? 0);
    expect(
      career.league.clubs.find((club) => club.id === weakerOffer?.clubId)?.strength,
    ).toBeLessThan(currentClub?.strength ?? 100);
  });

  it("can generate no offers for a poor season profile", () => {
    const career: CareerState = {
      ...createCareer(),
      player: {
        ...createCareer().player,
        age: 24,
        position: "CB",
        playStyle: "stopper",
      },
      reputation: 5,
      coachTrust: 5,
      seasonStats: {
        ...createCareer().seasonStats,
        appearances: 7,
        averageRating: 4.2,
      },
    };

    expect(generateContractOffers(career)).toHaveLength(0);
  });
});

describe("contract offer decisions", () => {
  it("accepting an offer changes club, role, salary, and fan support", () => {
    const career = createHighValueCareer();
    const offer = generateContractOffers(career).find(
      (candidate) => candidate.type === "strongerLowerPlayingTime",
    );

    expect(offer).toBeDefined();

    const updatedCareer = acceptContractOffer(career, offer!.id);

    expect(updatedCareer.player.clubId).toBe(offer!.clubId);
    expect(updatedCareer.salary).toBe(offer!.salary);
    expect(updatedCareer.contractYearsLeft).toBe(offer!.contractYears);
    expect(updatedCareer.squadRole).toBe(offer!.squadRole);
    expect(updatedCareer.fanSupport).toBe(career.fanSupport + offer!.fanSupportChange);
    expect(updatedCareer.acceptedContractOfferId).toBe(offer!.id);
    expect(updatedCareer.eventLog.at(-1)?.title).toBe("계약 제안 수락");
  });

  it("rejecting an offer records the rejection without changing the contract", () => {
    const career = createHighValueCareer();
    const offer = generateContractOffers(career)[0];
    const updatedCareer = rejectContractOffer(career, offer.id);

    expect(updatedCareer.player.clubId).toBe(career.player.clubId);
    expect(updatedCareer.salary).toBe(career.salary);
    expect(updatedCareer.rejectedContractOfferIds).toContain(offer.id);
    expect(updatedCareer.eventLog.at(-1)?.title).toBe("계약 제안 거절");
  });
});
