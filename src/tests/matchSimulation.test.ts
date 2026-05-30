import { describe, expect, it } from "vitest";
import { STARTER_CLUBS } from "../data/clubs";
import { createNewCareer } from "../game/career";
import {
  generateKeyMoments,
  simulateCurrentMatch,
} from "../game/matchSimulation";
import { applyWeeklyAction, canSimulateCurrentMatch } from "../game/weeklyActions";

function createMatchReadyCareer() {
  const career = createNewCareer({
    name: "Tester",
    nationality: "KOR",
    age: 18,
    preferredFoot: "right",
    position: "ST",
    playStyle: "poacher",
    personality: "diligent",
    clubId: STARTER_CLUBS[0].id,
  });

  return applyWeeklyAction(career, {
    actionType: "teamTraining",
    createdAt: "2026-05-31T00:00:00.000Z",
  });
}

describe("generateKeyMoments", () => {
  it("creates one to three deterministic key moments for a seed", () => {
    const career = createMatchReadyCareer();
    const first = generateKeyMoments(career, "seed-a");
    const second = generateKeyMoments(career, "seed-a");

    expect(first.length).toBeGreaterThanOrEqual(1);
    expect(first.length).toBeLessThanOrEqual(3);
    expect(second).toEqual(first);
    expect(first[0].choices).toHaveLength(3);
  });
});

describe("simulateCurrentMatch", () => {
  it("simulates deterministically with the same seed and choices", () => {
    const career = createMatchReadyCareer();
    const moments = generateKeyMoments(career, "match-seed");
    const choices = Object.fromEntries(
      moments.map((moment) => [moment.id, moment.choices[0].id]),
    );

    const first = simulateCurrentMatch(career, {
      seed: "match-seed",
      moments,
      choices,
      createdAt: "2026-05-31T01:00:00.000Z",
    });
    const second = simulateCurrentMatch(career, {
      seed: "match-seed",
      moments,
      choices,
      createdAt: "2026-05-31T01:00:00.000Z",
    });

    expect(second.match.result).toEqual(first.match.result);
    expect(second.careerState.seasonStats).toEqual(first.careerState.seasonStats);
  });

  it("produces score, minutes, rating, stats, modifiers, and key moments", () => {
    const career = createMatchReadyCareer();
    const moments = generateKeyMoments(career, "match-shape");
    const choices = Object.fromEntries(
      moments.map((moment) => [moment.id, moment.choices[0].id]),
    );
    const output = simulateCurrentMatch(career, {
      seed: "match-shape",
      moments,
      choices,
    });
    const result = output.match.result;

    expect(output.match.status).toBe("played");
    expect(result?.homeGoals).toBeGreaterThanOrEqual(0);
    expect(result?.awayGoals).toBeGreaterThanOrEqual(0);
    expect(result?.playerMinutes).toBeGreaterThanOrEqual(45);
    expect(result?.playerRating).toBeGreaterThanOrEqual(1);
    expect(result?.playerRating).toBeLessThanOrEqual(10);
    expect(result?.playerStats?.shots).toBeGreaterThanOrEqual(1);
    expect(result?.ratingModifiers?.length).toBeGreaterThan(0);
    expect(result?.keyMoments).toHaveLength(moments.length);
    expect(result?.keyMoments?.every((moment) => moment.outcome)).toBe(true);
  });

  it("updates career state after the match", () => {
    const career = createMatchReadyCareer();
    const moments = generateKeyMoments(career, "match-update");
    const choices = Object.fromEntries(
      moments.map((moment) => [moment.id, moment.choices[0].id]),
    );
    const output = simulateCurrentMatch(career, {
      seed: "match-update",
      moments,
      choices,
    });

    expect(output.careerState.seasonStats.appearances).toBe(1);
    expect(output.careerState.seasonStats.minutesPlayed).toBe(
      output.match.result?.playerStats?.minutesPlayed,
    );
    expect(output.careerState.condition).toBe(career.condition - 8);
    expect(output.careerState.fatigue).toBe(career.fatigue + 12);
    expect(output.careerState.eventLog.at(-1)?.title).toBe("경기 완료");
    expect(output.careerState.developmentLog.at(-1)?.source).toBe("match");
    expect(canSimulateCurrentMatch(output.careerState)).toBe(false);
  });
});
