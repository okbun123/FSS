import { describe, expect, it } from "vitest";
import { STARTER_CLUBS } from "../data/clubs";
import { createNewCareer } from "../game/career";
import {
  applyWeeklyAction,
  canSimulateCurrentMatch,
} from "../game/weeklyActions";

function createCareer() {
  return createNewCareer({
    name: "테스트",
    nationality: "대한민국",
    age: 18,
    preferredFoot: "right",
    position: "ST",
    playStyle: "poacher",
    personality: "diligent",
    clubId: STARTER_CLUBS[0].id,
  });
}

describe("applyWeeklyAction", () => {
  it("improves coach trust and tactical fit from team training", () => {
    const career = createCareer();
    const updatedCareer = applyWeeklyAction(career, {
      actionType: "teamTraining",
      createdAt: "2026-05-31T00:00:00.000Z",
    });

    expect(updatedCareer.coachTrust).toBe(career.coachTrust + 4);
    expect(updatedCareer.tacticalFit).toBe(career.tacticalFit + 6);
    expect(updatedCareer.fatigue).toBe(career.fatigue + 6);
    expect(updatedCareer.weeklyActionCompleted).toBe(true);
    expect(updatedCareer.eventLog.at(-1)?.title).toBe("팀 훈련 완료");
  });

  it("improves the selected attribute from individual training", () => {
    const career = createCareer();
    const updatedCareer = applyWeeklyAction(career, {
      actionType: "individualTraining",
      attributeFocus: "technical.passing",
    });

    expect(updatedCareer.player.attributes.technical.passing).toBeGreaterThan(
      career.player.attributes.technical.passing,
    );
    expect(updatedCareer.player.attributes.technical.passing).toBeLessThan(
      career.player.attributes.technical.passing + 1,
    );
    expect(updatedCareer.developmentLog.at(-1)?.title).toBe("이번 주 훈련 성장");
    expect(updatedCareer.fatigue).toBe(career.fatigue + 10);
    expect(updatedCareer.condition).toBe(career.condition - 4);
  });

  it("recovers condition and lowers fatigue", () => {
    const career = createCareer();
    const updatedCareer = applyWeeklyAction(career, { actionType: "recovery" });

    expect(updatedCareer.condition).toBe(career.condition + 14);
    expect(updatedCareer.fatigue).toBe(0);
    expect(updatedCareer.form).toBe(career.form + 2);
  });

  it("raises media values while applying a small mental risk", () => {
    const career = createCareer();
    const updatedCareer = applyWeeklyAction(career, { actionType: "mediaActivity" });

    expect(updatedCareer.reputation).toBe(career.reputation + 5);
    expect(updatedCareer.fanSupport).toBe(career.fanSupport + 6);
    expect(updatedCareer.player.attributes.mental.composure).toBe(
      career.player.attributes.mental.composure - 1,
    );
    expect(updatedCareer.form).toBe(career.form - 2);
  });

  it("improves teamwork and coach trust through relationship work", () => {
    const career = createCareer();
    const updatedCareer = applyWeeklyAction(career, { actionType: "relationship" });

    expect(updatedCareer.player.attributes.mental.teamwork).toBeGreaterThan(
      career.player.attributes.mental.teamwork,
    );
    expect(updatedCareer.player.attributes.mental.teamwork).toBeLessThan(
      career.player.attributes.mental.teamwork + 1,
    );
    expect(updatedCareer.coachTrust).toBe(career.coachTrust + 2);
  });

  it("enables match simulation after a weekly action when a match exists", () => {
    const career = createCareer();

    expect(canSimulateCurrentMatch(career)).toBe(false);

    const updatedCareer = applyWeeklyAction(career, { actionType: "teamTraining" });

    expect(canSimulateCurrentMatch(updatedCareer)).toBe(true);
  });

  it("does not allow a second weekly action in the same week", () => {
    const career = applyWeeklyAction(createCareer(), { actionType: "teamTraining" });

    expect(() => applyWeeklyAction(career, { actionType: "recovery" })).toThrow(
      "Weekly action has already been completed.",
    );
  });
});
