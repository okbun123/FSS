import { describe, expect, it } from "vitest";
import {
  K1_LEAGUE_ID,
  K2_LEAGUE_ID,
  K3_LEAGUE_ID,
  K4_LEAGUE_ID,
  STARTER_CLUBS,
} from "../data/fictionalLeagues";
import {
  CAREER_DASHBOARD_TABS,
  CAREER_DASHBOARD_SECTIONS,
  CLUB_DASHBOARD_SECTIONS,
  LEAGUE_DASHBOARD_SECTIONS,
  getCareerRecentResultRows,
  getClubFixtureRows,
  getLeagueZoneDisplay,
  getLeagueStandingsRows,
  getMainActionLabel,
  getSeasonReportSections,
} from "../screens/CareerDashboardScreen";
import { advanceWeek, createNewCareer, resolveActiveMatch } from "../game/monthlyCareer";
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
      "소속팀",
      "커리어",
      "리그",
    ]);
    expect(CAREER_DASHBOARD_TABS.map((tab) => tab.id)).toEqual([
      "main",
      "player",
      "club",
      "career",
      "league",
    ]);
  });

  it("splits dense dashboard tabs into fixed subtab contracts", () => {
    expect(CLUB_DASHBOARD_SECTIONS.map((tab) => tab.id)).toEqual(["overview", "schedule", "squad"]);
    expect(CAREER_DASHBOARD_SECTIONS.map((tab) => tab.id)).toEqual(["season", "logs", "history"]);
    expect(LEAGUE_DASHBOARD_SECTIONS.map((tab) => tab.id)).toEqual(["standings", "fixtures", "rules", "cups"]);
  });

  it("supports create, weekly progress, save, and load state for the tabbed page", () => {
    const storage = new MemoryStorage();
    const career = createCareer();
    const progressed = advanceWeek(career, {
      selectedChoiceId: career.currentEvent?.choices[0]?.id,
      createdAt: "2027-02-01T00:00:00.000Z",
    });
    const advanced = progressed.activeMatchId ? resolveActiveMatch(progressed) : progressed;

    saveCareerState(advanced, storage, new Date("2027-02-01T00:00:00.000Z"));
    const loaded = loadCareerSave(storage);

    expect(storage.getItem(CAREER_SAVE_KEY)).not.toBeNull();
    expect(new Date(advanced.currentDate).getTime()).toBeGreaterThan(new Date(career.currentDate).getTime());
    expect(loaded.status).toBe("loaded");

    if (loaded.status === "loaded") {
      expect(loaded.save.careerState.currentDate).toBe(advanced.currentDate);
      expect(loaded.save.careerState.player.name).toBe("탭 테스트");
    }
  });

  it("places club fixtures under the Club tab data contract", () => {
    const career = createCareer();
    const rows = getClubFixtureRows(career);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveLength(6);
  });

  it("places recent results under the Career tab data contract", () => {
    let advanced = createCareer();

    for (let week = 0; week < 8 && advanced.recentResults.length === 0; week += 1) {
      const progressed = advanceWeek(advanced, {
        selectedChoiceId: advanced.currentEvent?.choices[0]?.id,
        createdAt: "2027-02-01T00:00:00.000Z",
      });
      advanced = progressed.activeMatchId ? resolveActiveMatch(progressed) : progressed;
    }

    const rows = getCareerRecentResultRows(advanced);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveLength(4);
  });

  it("returns different standings when the league selector changes", () => {
    const career = createCareer();
    const k1Rows = getLeagueStandingsRows(career, K1_LEAGUE_ID);
    const k2Rows = getLeagueStandingsRows(career, K2_LEAGUE_ID);

    expect(k1Rows.length).toBeGreaterThan(0);
    expect(k2Rows.length).toBeGreaterThan(0);
    expect(k1Rows.map((row) => row[1])).not.toEqual(k2Rows.map((row) => row[1]));
  });

  it("exposes standings for every playable division in the league browser helpers", () => {
    const career = createCareer();

    for (const leagueId of [K1_LEAGUE_ID, K2_LEAGUE_ID, K3_LEAGUE_ID, K4_LEAGUE_ID] as const) {
      const rows = getLeagueStandingsRows(career, leagueId);

      expect(rows.length).toBe(career.leagues[leagueId].clubs.length);
      expect(rows[0]).toHaveLength(9);
    }
  });

  it("labels the main action based on weekly match state", () => {
    const career = createCareer();
    const opened = advanceWeek(career, {
      selectedChoiceId: career.currentEvent?.choices[0]?.id,
      createdAt: "2027-02-01T00:00:00.000Z",
    });

    expect(["경기 진행", "다음 주로 진행"]).toContain(getMainActionLabel(career));

    if (opened.activeMatchId) {
      expect(getMainActionLabel(opened)).toBe("경기창으로 돌아가기");
    }
  });

  it("exposes readable season report sections", () => {
    const career = createCareer();
    const sections = getSeasonReportSections(career);

    expect(sections.map((section) => section.title)).toEqual([
      "시즌 총평",
      "개인 기록",
      "팀 성적",
      "성장 요약",
      "이적/계약 상황",
      "다음 시즌 전망",
    ]);
    expect(sections.every((section) => section.body.length > 10)).toBe(true);
  });

  it("maps league zones to green, orange, and red display bands", () => {
    const career = createCareer();
    const leagueIds = [K1_LEAGUE_ID, K2_LEAGUE_ID, K3_LEAGUE_ID, K4_LEAGUE_ID] as const;
    const tones = leagueIds.flatMap((leagueId) =>
      career.season.tables[leagueId].map((row) => getLeagueZoneDisplay(career, leagueId, row).tone),
    );

    expect(tones).toContain("green");
    expect(tones).toContain("orange");
    expect(tones).toContain("red");
  });
});
