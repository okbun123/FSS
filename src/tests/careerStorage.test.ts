import { describe, expect, it } from "vitest";
import { STARTER_CLUBS } from "../data/fictionalLeagues";
import { createNewCareer } from "../game/monthlyCareer";
import { generatePlayerRoll } from "../game/playerGeneration";
import {
  CAREER_SAVE_KEY,
  clearSavedCareerState,
  createCareerSaveFile,
  CURRENT_SAVE_VERSION,
  loadCareerSave,
  saveCareerState,
  type StorageLike,
} from "../storage/careerStorage";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function createCareer() {
  const roll = generatePlayerRoll("storage-career");

  return createNewCareer({
    name: "저장 테스트",
    nationality: "대한민국",
    clubId: STARTER_CLUBS[0].id,
    position: roll.recommendations[0].position,
    roll,
  });
}

describe("careerStorage v2", () => {
  it("saves and loads a versioned monthly career", () => {
    const storage = new MemoryStorage();
    const career = createCareer();
    const savedAt = new Date("2027-01-01T00:00:00.000Z");

    const saveFile = saveCareerState(career, storage, savedAt);
    const result = loadCareerSave(storage);

    expect(saveFile.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(result.status).toBe("loaded");

    if (result.status === "loaded") {
      expect(result.save.careerState.player.leftFoot).toBeGreaterThanOrEqual(1);
      expect(result.save.careerState.player.selectedPosition).toBeDefined();
      expect(result.save.careerState.player.dominantFoot).toMatch(/left|right|both/);
      expect(result.save.savedAt).toBe("2027-01-01T00:00:00.000Z");
    }
  });

  it("normalizes older v2 monthly saves that lack new player model fields", () => {
    const storage = new MemoryStorage();
    const career = createCareer() as unknown as Record<string, unknown>;
    const player = career.player as Record<string, unknown>;

    player.position = player.selectedPosition;
    delete player.selectedPosition;
    delete player.recommendedPositions;
    delete player.dominantFoot;
    delete player.OVR;
    delete player.form;
    delete player.condition;
    delete player.fatigue;
    delete player.reputation;
    delete player.coachTrust;
    delete player.marketValue;

    storage.setItem(
      CAREER_SAVE_KEY,
      JSON.stringify({
        saveVersion: CURRENT_SAVE_VERSION,
        savedAt: "2027-01-01T00:00:00.000Z",
        careerState: career,
      }),
    );

    const result = loadCareerSave(storage);

    expect(result.status).toBe("loaded");

    if (result.status === "loaded") {
      expect(result.save.careerState.player.selectedPosition).toBe(result.save.careerState.player.position);
      expect(result.save.careerState.player.recommendedPositions.length).toBeGreaterThan(0);
      expect(result.save.careerState.player.marketValue).toBeGreaterThan(0);
    }
  });

  it("creates a save file envelope without touching storage", () => {
    const career = createCareer();
    const saveFile = createCareerSaveFile(career, new Date("2027-02-01T00:00:00.000Z"));

    expect(saveFile.saveVersion).toBe(2);
    expect(saveFile.careerState.season.currentMonth).toBe(1);
  });

  it("rejects incompatible weekly v1 saves without deleting them", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      CAREER_SAVE_KEY,
      JSON.stringify({
        saveVersion: 1,
        savedAt: "2026-05-31T12:00:00.000Z",
        careerState: { player: { name: "구버전" }, season: { matches: [] }, currentWeek: 1 },
      }),
    );

    const result = loadCareerSave(storage);

    expect(result.status).toBe("unsupportedVersion");
    expect(storage.getItem(CAREER_SAVE_KEY)).not.toBeNull();
  });

  it("clears saved career data", () => {
    const storage = new MemoryStorage();
    saveCareerState(createCareer(), storage);

    clearSavedCareerState(storage);

    expect(storage.getItem(CAREER_SAVE_KEY)).toBeNull();
  });
});
