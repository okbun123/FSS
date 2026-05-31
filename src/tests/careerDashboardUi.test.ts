import { describe, expect, it } from "vitest";
import { STARTER_CLUBS } from "../data/fictionalLeagues";
import { CAREER_DASHBOARD_TABS } from "../screens/CareerDashboardScreen";
import { advanceMonth, createNewCareer } from "../game/monthlyCareer";
import { generatePlayerRoll } from "../game/playerGeneration";
import {
  CAREER_SAVE_KEY,
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
  const roll = generatePlayerRoll("dashboard-ui-career");

  return createNewCareer({
    name: "탭 테스트",
    nationality: "대한민국",
    clubId: STARTER_CLUBS[0].id,
    position: roll.recommendations[0].position,
    roll,
  });
}

describe("career dashboard UI contract", () => {
  it("exposes the five required Korean tabs in order", () => {
    expect(CAREER_DASHBOARD_TABS.map((tab) => tab.label)).toEqual([
      "메인",
      "선수 상태",
      "경기 일정",
      "커리어",
      "소속팀/리그",
    ]);
    expect(CAREER_DASHBOARD_TABS.map((tab) => tab.id)).toEqual([
      "main",
      "player",
      "schedule",
      "career",
      "club",
    ]);
  });

  it("supports create, progress, save, and load state for the tabbed page", () => {
    const storage = new MemoryStorage();
    const career = createCareer();
    const advanced = advanceMonth(career, {
      selectedChoiceId: career.currentEvent?.choices[0]?.id,
      createdAt: "2027-02-01T00:00:00.000Z",
    });

    saveCareerState(advanced, storage, new Date("2027-02-01T00:00:00.000Z"));
    const loaded = loadCareerSave(storage);

    expect(storage.getItem(CAREER_SAVE_KEY)).not.toBeNull();
    expect(advanced.season.currentMonth).toBe(2);
    expect(loaded.status).toBe("loaded");

    if (loaded.status === "loaded") {
      expect(loaded.save.careerState.season.currentMonth).toBe(2);
      expect(loaded.save.careerState.player.name).toBe("탭 테스트");
    }
  });
});
