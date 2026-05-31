import { describe, expect, it } from "vitest";
import { STARTER_CLUBS } from "../data/clubs";
import { createNewCareer } from "../game/career";
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

describe("careerStorage", () => {
  it("saves and loads a versioned career save file", () => {
    const storage = new MemoryStorage();
    const career = createCareer();
    const savedAt = new Date("2026-05-31T12:00:00.000Z");

    const saveFile = saveCareerState(career, storage, savedAt);
    const result = loadCareerSave(storage);

    expect(saveFile.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(saveFile.savedAt).toBe("2026-05-31T12:00:00.000Z");
    expect(result.status).toBe("loaded");

    if (result.status === "loaded") {
      expect(result.save.careerState.player.name).toBe("테스트");
      expect(result.save.savedAt).toBe(saveFile.savedAt);
    }
  });

  it("creates a save file envelope without touching storage", () => {
    const career = createCareer();
    const saveFile = createCareerSaveFile(career, new Date("2026-05-31T09:00:00.000Z"));

    expect(saveFile).toEqual({
      saveVersion: CURRENT_SAVE_VERSION,
      savedAt: "2026-05-31T09:00:00.000Z",
      careerState: career,
    });
  });

  it("returns empty when no save exists", () => {
    expect(loadCareerSave(new MemoryStorage())).toEqual({ status: "empty" });
  });

  it("returns invalid for corrupted JSON", () => {
    const storage = new MemoryStorage();
    storage.setItem(CAREER_SAVE_KEY, "{bad json");

    const result = loadCareerSave(storage);

    expect(result.status).toBe("invalid");
  });

  it("returns invalid for old raw career state data", () => {
    const storage = new MemoryStorage();
    storage.setItem(CAREER_SAVE_KEY, JSON.stringify(createCareer()));

    const result = loadCareerSave(storage);

    expect(result.status).toBe("invalid");
  });

  it("returns unsupportedVersion for a mismatched save version", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      CAREER_SAVE_KEY,
      JSON.stringify({
        saveVersion: 0,
        savedAt: "2026-05-31T12:00:00.000Z",
        careerState: createCareer(),
      }),
    );

    const result = loadCareerSave(storage);

    expect(result.status).toBe("unsupportedVersion");
  });

  it("normalizes older versioned career data with weekly defaults", () => {
    const storage = new MemoryStorage();
    const olderCareer = createCareer() as unknown as Record<string, unknown>;
    delete olderCareer.tacticalFit;
    delete olderCareer.weeklyActionCompleted;
    delete olderCareer.eventLog;
    delete olderCareer.seasonBaseline;
    delete olderCareer.careerHistory;
    delete olderCareer.salary;
    delete olderCareer.contractYearsLeft;
    delete olderCareer.squadRole;
    delete olderCareer.seasonOffers;
    delete olderCareer.rejectedContractOfferIds;

    storage.setItem(
      CAREER_SAVE_KEY,
      JSON.stringify({
        saveVersion: CURRENT_SAVE_VERSION,
        savedAt: "2026-05-31T12:00:00.000Z",
        careerState: olderCareer,
      }),
    );

    const result = loadCareerSave(storage);

    expect(result.status).toBe("loaded");

    if (result.status === "loaded") {
      expect(result.save.careerState.tacticalFit).toBe(42);
      expect(result.save.careerState.weeklyActionCompleted).toBe(false);
      expect(result.save.careerState.availableWeeklyActions[0].label).toBe("팀 훈련");
      expect(result.save.careerState.eventLog).toHaveLength(1);
      expect(result.save.careerState.seasonBaseline.seasonNumber).toBe(1);
      expect(result.save.careerState.seasonBaseline.clubId).toBe(result.save.careerState.player.clubId);
      expect(result.save.careerState.careerHistory).toEqual([]);
      expect(result.save.careerState.salary).toBe(900);
      expect(result.save.careerState.contractYearsLeft).toBe(2);
      expect(result.save.careerState.squadRole).toBe("prospect");
      expect(result.save.careerState.seasonOffers).toEqual([]);
      expect(result.save.careerState.rejectedContractOfferIds).toEqual([]);
    }
  });

  it("clears saved career data", () => {
    const storage = new MemoryStorage();
    saveCareerState(createCareer(), storage);

    clearSavedCareerState(storage);

    expect(storage.getItem(CAREER_SAVE_KEY)).toBeNull();
  });
});
