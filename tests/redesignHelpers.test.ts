import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DOMESTIC_CUP_COMPETITION_ID,
  FICTIONAL_LEAGUES,
  K1_LEAGUE_ID,
  K4_LEAGUE_ID,
  getAllClubs,
} from "../src/data/fictionalLeagues";
import { NON_PLAYABLE_D5_CLUBS } from "../src/data/nonPlayableClubs";
import { formatStars, getPublicClubStars, getVisibleClubInfoItems, toStarRating } from "../src/domain/clubPublicInfo";
import { createInitialDomesticCupFixtures, progressDomesticCupFixtures } from "../src/domain/domesticCup";
import { getVisibleMatchLogEvents } from "../src/domain/matchLog";
import { applySeasonRollover } from "../src/domain/seasonRollover";
import { TEAM_FIT_ROLE_LABELS, calculateTeamFit, getTeamFitBand } from "../src/domain/teamFit";
import { createNewCareer, startNextSeason } from "../src/game/monthlyCareer";
import { generatePlayerRoll } from "../src/game/playerGeneration";
import {
  CREATION_STEPS,
  CREATION_TEAM_PAGE_SIZE,
  canSelectCreationPosition,
  canSelectCreationTeam,
  getCreationTeamDisplayRow,
  getCreationTeamRows,
  getCreationPositionOptions,
  getCreationStatPanelItems,
  getPoorFitRiskNote,
  getPositionFitBand,
  getPositionFitBandLabel,
  getPositionFitLabel,
  getRelativePositionFitBand,
  getTeamFitColorClass,
} from "../src/screens/PlayerCreationScreen";
import { generateLeagueFixtures } from "../src/game/leagueSchedule";
import type { Club, Fixture, MatchEvent, Position, PromotionRelegationStatus } from "../src/domain/types";

function event(input: Partial<MatchEvent> & Pick<MatchEvent, "id" | "type">): MatchEvent {
  return {
    matchId: "match-1",
    minute: 10,
    phase: "FIRST_HALF",
    description: input.type,
    pausesSimulation: true,
    ...input,
  };
}

describe("fixed-screen redesign helpers", () => {
  it("converts exact club internals into public star bands", () => {
    expect(toStarRating(39)).toBe(1);
    expect(toStarRating(40)).toBe(2);
    expect(toStarRating(55)).toBe(3);
    expect(toStarRating(70)).toBe(4);
    expect(toStarRating(85)).toBe(5);

    const stars = getPublicClubStars(getAllClubs()[0]);
    const visibleItems = getVisibleClubInfoItems(getAllClubs()[0]);

    expect(formatStars(stars.reputationStars)).toMatch(/★/);
    expect(Object.values(stars).every((value) => value >= 1 && value <= 5)).toBe(true);
    expect(visibleItems.map((item) => item.label)).toEqual(["평판", "전력", "예산", "유스 기회", "훈련 시설"]);
    expect(visibleItems.every((item) => /^[★☆]{5}$/.test(item.value))).toBe(true);
  });

  it("keeps all four playable divisions and creates an FA-style preliminary cup entry list", () => {
    expect(Object.keys(FICTIONAL_LEAGUES)).toHaveLength(4);
    expect(getAllClubs()).toHaveLength(64);

    const fixtures = createInitialDomesticCupFixtures({
      clubs: getAllClubs(),
      seasonNumber: 1,
      seasonYear: 2027,
    });

    expect(fixtures).toHaveLength(5);
    expect(fixtures.every((fixture) => fixture.competitionId === DOMESTIC_CUP_COMPETITION_ID)).toBe(true);
    expect(fixtures.every((fixture) => fixture.round === 0)).toBe(true);
    expect(fixtures.every((fixture) => fixture.date === "2027-03-17T11:00:00.000Z")).toBe(true);
  });

  it("generates the next domestic cup round only after the current round completes", () => {
    const preliminary = createInitialDomesticCupFixtures({
      clubs: getAllClubs(),
      seasonNumber: 1,
      seasonYear: 2027,
    }).map((fixture, index): Fixture => ({
      ...fixture,
      status: "played",
      result: {
        homeGoals: index % 2 === 0 ? 2 : 0,
        awayGoals: index % 2 === 0 ? 0 : 2,
        winnerClubId: index % 2 === 0 ? fixture.homeClubId : fixture.awayClubId,
      },
    }));

    const progressed = progressDomesticCupFixtures({
      fixtures: preliminary,
      clubsById: Object.fromEntries(getAllClubs().map((club) => [club.id, club])),
      seasonNumber: 1,
      seasonYear: 2027,
    });
    const firstRound = progressed.filter((fixture) => fixture.round === 1);

    expect(firstRound).toHaveLength(19);
    expect(firstRound.every((fixture) => fixture.date === "2027-04-07T11:00:00.000Z")).toBe(true);
  });

  it("filters match logs without losing major events", () => {
    const visible = getVisibleMatchLogEvents(
      [
        event({ id: "goal-other", type: "goal", playerId: "other" }),
        event({ id: "red-other", type: "straightRed", playerId: "other" }),
        event({ id: "red-card-other", type: "redCard", playerId: "other" }),
        event({ id: "yellow-hidden", type: "yellowCard", playerId: "other" }),
        event({ id: "yellow-user", type: "yellowCard", playerId: "player-1" }),
        event({ id: "sub-hidden", type: "substitution", playerId: "other", relatedPlayerId: "teammate" }),
        event({ id: "sub-in-user", type: "substitutionIn", playerId: "player-1" }),
        event({ id: "sub-out-user", type: "substitutionOut", relatedPlayerId: "player-1" }),
        event({ id: "injury-hidden", type: "injury", playerId: "other" }),
        event({ id: "injury-user", type: "injury", playerId: "player-1" }),
      ],
      "player-1",
    );

    expect(visible.map((item) => item.id)).toEqual([
      "goal-other",
      "red-other",
      "red-card-other",
      "yellow-user",
      "sub-in-user",
      "sub-out-user",
      "injury-user",
    ]);
  });

  it("projects team role labels through the pure team-fit helper", () => {
    const club = FICTIONAL_LEAGUES[K4_LEAGUE_ID].clubs[0];
    const fit = calculateTeamFit({
      club,
      league: FICTIONAL_LEAGUES[K4_LEAGUE_ID],
      playerOverall: 68,
      selectedPosition: "ST",
    });

    expect(["bench", "rotation", "starter"]).toContain(fit.role);
    expect(Object.values(TEAM_FIT_ROLE_LABELS)).toEqual(["벤치", "로테이션", "주전"]);
  });

  it("calculates projected team roles from OVR, level, squad context, and youth opportunity", () => {
    const baseClub = FICTIONAL_LEAGUES[K4_LEAGUE_ID].clubs[0];
    const youthFriendlyClub: Club = {
      ...baseClub,
      reputation: 36,
      squadStrength: 50,
      youthOpportunity: 88,
      squadSummary: { ...baseClub.squadSummary, depth: 50 },
      positionDepth: { ...baseClub.positionDepth, ST: 50 },
    };
    const k1Club = FICTIONAL_LEAGUES[K1_LEAGUE_ID].clubs[0];
    const demandingClub: Club = {
      ...k1Club,
      reputation: 88,
      squadStrength: 82,
      youthOpportunity: 45,
      squadSummary: { ...k1Club.squadSummary, depth: 82 },
      positionDepth: { ...k1Club.positionDepth, ST: 82 },
    };

    expect(calculateTeamFit({
      club: demandingClub,
      league: FICTIONAL_LEAGUES[demandingClub.leagueId],
      playerOverall: 54,
      selectedPosition: "ST",
    }).role).toBe("bench");
    expect(calculateTeamFit({
      club: youthFriendlyClub,
      league: FICTIONAL_LEAGUES[K4_LEAGUE_ID],
      playerOverall: 32,
      selectedPosition: "ST",
    }).role).toBe("rotation");
    expect(calculateTeamFit({
      club: youthFriendlyClub,
      league: FICTIONAL_LEAGUES[K4_LEAGUE_ID],
      playerOverall: 56,
      selectedPosition: "ST",
    }).role).toBe("starter");
  });

  it("defines the fixed character creation steps and stat panel contract", () => {
    const source = readFileSync(resolve(process.cwd(), "src/screens/PlayerCreationScreen.tsx"), "utf8");
    const roll = generatePlayerRoll("creation-stat-panel");
    const statItems = getCreationStatPanelItems(roll, roll.recommendations[0].position);

    expect(CREATION_STEPS.map((step) => step.label)).toEqual([
      "선수 생성 / 능력치 뽑기",
      "포지션 선택",
      "팀 선택",
      "확인",
    ]);
    expect(source).toContain("creation-left-rail");
    expect(source).toContain("creation-stat-panel");
    expect(source).toContain("다시 뽑기");
    expect(source).toContain("다음: 포지션 선택");
    expect(statItems.map((item) => item.label)).toEqual([
      "나이",
      "OVR",
      "주발",
      "잠재력",
      "유형",
    ]);
    expect(statItems.find((item) => item.label === "유형")?.value).toBe(roll.archetype);
    expect(source).toContain("leftFoot");
    expect(source).toContain("rightFoot");
  });

  it("rerolling the creation seed changes visible stat panel values", () => {
    const first = getCreationStatPanelItems(
      generatePlayerRoll("creation-reroll-before"),
      "ST",
    );
    const second = getCreationStatPanelItems(
      generatePlayerRoll("creation-reroll-after"),
      "ST",
    );

    expect(first).not.toEqual(second);
  });

  it("renders all positions as selectable fit-sorted creation options", () => {
    const source = readFileSync(resolve(process.cwd(), "src/screens/PlayerCreationScreen.tsx"), "utf8");
    const expectedPositions: Position[] = ["ST", "LW", "RW", "AM", "CM", "DM", "FB", "CB"];
    const options = getCreationPositionOptions(generatePlayerRoll("creation-position-options"));

    expect(options).toHaveLength(expectedPositions.length);
    expect(new Set(options.map((option) => option.position))).toEqual(new Set(expectedPositions));
    expect(options.map((option) => option.fitScore)).toEqual(
      [...options].map((option) => option.fitScore).sort((left, right) => right - left),
    );
    expect(options.every((option) => canSelectCreationPosition(option))).toBe(true);
    expect(expectedPositions.every((position) => canSelectCreationPosition({ position }))).toBe(true);
    expect(source).toContain("positionOptions.map");
    expect(source).toContain("aria-pressed");
  });

  it("maps position fit bands across the red-to-green score ranges", () => {
    expect(getPositionFitBand(0)).toBe("fit-poor");
    expect(getPositionFitBand(39)).toBe("fit-poor");
    expect(getPositionFitBand(40)).toBe("fit-weak");
    expect(getPositionFitBand(54)).toBe("fit-weak");
    expect(getPositionFitBand(55)).toBe("fit-average");
    expect(getPositionFitBand(69)).toBe("fit-average");
    expect(getPositionFitBand(70)).toBe("fit-good");
    expect(getPositionFitBand(84)).toBe("fit-good");
    expect(getPositionFitBand(85)).toBe("fit-excellent");
    expect(getPositionFitBand(100)).toBe("fit-excellent");
    expect(getPositionFitLabel(38)).toBe("위험");
    expect(getPositionFitLabel(88)).toBe("최상");
    expect(getPositionFitBandLabel("fit-good")).toBe("좋음");
  });

  it("colors position fit relative to the generated player", () => {
    const options = getCreationPositionOptions(generatePlayerRoll("low-overall-relative-fit"));
    const topOption = options[0];

    expect(getRelativePositionFitBand(topOption, options)).toBe("fit-excellent");
    expect(getPositionFitBandLabel(getRelativePositionFitBand(topOption, options))).toBe("최상");
  });

  it("allows selecting a poor-fit position and exposes its risk note", () => {
    const poorFitRecommendation = {
      position: "CB" as const,
      fitScore: 12,
      keyWeaknesses: ["마킹"],
    };

    expect(canSelectCreationPosition(poorFitRecommendation)).toBe(true);
    expect(getPositionFitBand(poorFitRecommendation.fitScore)).toBe("fit-poor");
    expect(getPoorFitRiskNote(poorFitRecommendation)).toContain("마킹");
  });

  it("renders all playable teams as selectable fit-sorted public rows", () => {
    const source = readFileSync(resolve(process.cwd(), "src/screens/PlayerCreationScreen.tsx"), "utf8");
    const roll = generatePlayerRoll("creation-team-options");
    const rows = getCreationTeamRows({
      clubs: getAllClubs(),
      leagues: FICTIONAL_LEAGUES,
      playerOverall: roll.recommendations[0].overall,
      selectedPosition: roll.recommendations[0].position,
      filters: {
        leagueFilter: "all",
        roleFilter: "all",
        reputationFilter: "all",
        trainingFilter: "all",
      },
    });

    expect(rows).toHaveLength(getAllClubs().length);
    expect(rows.map((row) => row.fit.score)).toEqual(
      [...rows].map((row) => row.fit.score).sort((left, right) => right - left),
    );
    expect(rows.every((row) => canSelectCreationTeam(row.club.id))).toBe(true);
    expect(new Set(rows.map((row) => row.club.leagueId))).toEqual(new Set(Object.keys(FICTIONAL_LEAGUES)));
    expect(source).toContain("국가 선택");
    expect(source).toContain("리그 선택");
    expect(source).toContain("team-selection-card");
  });

  it("can select and start a career with a Division 4 team", () => {
    const division4Club = FICTIONAL_LEAGUES[K4_LEAGUE_ID].clubs[0];
    const roll = generatePlayerRoll("division-4-selection");

    expect(canSelectCreationTeam(division4Club.id)).toBe(true);

    const career = createNewCareer({
      name: "디비전 사 테스트",
      nationality: "대한민국",
      clubId: division4Club.id,
      position: roll.recommendations[0].position,
      roll,
    });

    expect(career.player.clubId).toBe(division4Club.id);
    expect(career.leagues[K4_LEAGUE_ID].clubs.map((club) => club.id)).toContain(division4Club.id);
  });

  it("filters team rows by league, projected role, reputation, and training stars", () => {
    const roll = generatePlayerRoll("creation-team-filters");
    const allRows = getCreationTeamRows({
      clubs: getAllClubs(),
      leagues: FICTIONAL_LEAGUES,
      playerOverall: roll.recommendations[0].overall,
      selectedPosition: roll.recommendations[0].position,
      filters: {
        leagueFilter: "all",
        roleFilter: "all",
        reputationFilter: "all",
        trainingFilter: "all",
      },
    });
    const targetRow = allRows.find((row) => row.club.leagueId === K4_LEAGUE_ID) ?? allRows[0];
    const rows = getCreationTeamRows({
      clubs: getAllClubs(),
      leagues: FICTIONAL_LEAGUES,
      playerOverall: roll.recommendations[0].overall,
      selectedPosition: roll.recommendations[0].position,
      filters: {
        leagueFilter: targetRow.club.leagueId,
        roleFilter: targetRow.fit.role,
        reputationFilter: targetRow.fit.reputationStars,
        trainingFilter: targetRow.fit.trainingFacilityStars,
      },
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.club.leagueId === targetRow.club.leagueId)).toBe(true);
    expect(rows.every((row) => row.fit.role === targetRow.fit.role)).toBe(true);
    expect(rows.every((row) => row.fit.reputationStars === targetRow.fit.reputationStars)).toBe(true);
    expect(rows.every((row) => row.fit.trainingFacilityStars === targetRow.fit.trainingFacilityStars)).toBe(true);
  });

  it("maps team fit bands to red-to-green CSS classes", () => {
    expect(getTeamFitBand(0)).toBe("poor");
    expect(getTeamFitBand(39)).toBe("poor");
    expect(getTeamFitBand(40)).toBe("weak");
    expect(getTeamFitBand(54)).toBe("weak");
    expect(getTeamFitBand(55)).toBe("average");
    expect(getTeamFitBand(69)).toBe("average");
    expect(getTeamFitBand(70)).toBe("good");
    expect(getTeamFitBand(84)).toBe("good");
    expect(getTeamFitBand(85)).toBe("excellent");
    expect(getTeamFitBand(100)).toBe("excellent");
    expect(getTeamFitColorClass({ band: "poor" })).toBe("fit-poor");
    expect(getTeamFitColorClass({ band: "excellent" })).toBe("fit-excellent");
  });

  it("keeps exact hidden club values out of creation team display rows", () => {
    const club = getAllClubs()[0];
    const [row] = getCreationTeamRows({
      clubs: [club],
      leagues: FICTIONAL_LEAGUES,
      playerOverall: 55,
      selectedPosition: "ST",
      filters: {
        leagueFilter: "all",
        roleFilter: "all",
        reputationFilter: "all",
        trainingFilter: "all",
      },
    });
    const displayRow = getCreationTeamDisplayRow(row);
    const publicText = [
      displayRow.teamName,
      displayRow.country,
      displayRow.leagueName,
      displayRow.youthOpportunityStars,
      displayRow.squadStrengthStars,
      displayRow.publicInfoText,
      displayRow.roleLabel,
      displayRow.fitLabel,
    ].join(" ");

    expect(displayRow.country).toBe(FICTIONAL_LEAGUES[club.leagueId].country);
    expect(displayRow.squadStrengthStars).toBe(formatStars(row.fit.squadStrengthStars));
    expect(displayRow.youthOpportunityStars).toBe(formatStars(row.fit.youthOpportunityStars));
    expect(displayRow.publicInfoText).toContain("전력");
    expect(displayRow.publicInfoText).toContain("유스");
    expect(displayRow.publicInfoText).not.toContain("평판");
    expect(displayRow.publicInfoText).not.toContain("예산");
    expect(displayRow.publicInfoText).not.toContain("훈련");
    expect(publicText).not.toContain(String(club.reputation));
    expect(publicText).not.toContain(String(club.squadStrength));
    expect(publicText).not.toContain(String(club.budgetLevel));
    expect(publicText).not.toContain(String(club.youthOpportunity));
    expect(Object.values(club.trainingFacilities).some((value) => publicText.includes(String(value)))).toBe(false);
  });

  it("removes hidden club scouting fields from dashboard and popup UI source", () => {
    const dashboardSource = readFileSync(resolve(process.cwd(), "src/screens/CareerDashboardScreen.tsx"), "utf8");
    const popupSource = readFileSync(resolve(process.cwd(), "src/components/TeamDetailModal.tsx"), "utf8");
    const creationSource = readFileSync(resolve(process.cwd(), "src/screens/PlayerCreationScreen.tsx"), "utf8");
    const combinedSource = [dashboardSource, popupSource, creationSource].join("\n");

    expect(combinedSource).not.toContain("플레이 스타일");
    expect(combinedSource).not.toContain("이적 정책");
    expect(combinedSource).not.toContain("평균 연령");
    expect(combinedSource).not.toContain("선수층");
    expect(combinedSource).not.toContain("기술 훈련");
    expect(combinedSource).not.toContain("피지컬 훈련");
    expect(combinedSource).not.toContain("전술 훈련");
    expect(combinedSource).not.toContain("멘탈 훈련");
    expect(combinedSource).not.toContain("의무 지원");
  });

  it("defines a hidden 5th-division promotion pool", () => {
    expect(NON_PLAYABLE_D5_CLUBS.length).toBeGreaterThanOrEqual(20);
    expect(NON_PLAYABLE_D5_CLUBS.length).toBeLessThanOrEqual(40);
    expect(NON_PLAYABLE_D5_CLUBS.every((club) => club.id.startsWith("d5-"))).toBe(true);
    expect(NON_PLAYABLE_D5_CLUBS.every((club) => club.lastPoolResult.length > 0)).toBe(true);
    expect(getAllClubs().some((club) => NON_PLAYABLE_D5_CLUBS.some((poolClub) => poolClub.id === club.id))).toBe(false);
    expect(
      NON_PLAYABLE_D5_CLUBS.every((club) =>
        [
          club.reputationStars,
          club.squadStrengthStars,
          club.budgetStars,
          club.youthOpportunityStars,
          club.trainingFacilityStars,
        ].every((stars) => stars >= 1 && stars <= 5),
      ),
    ).toBe(true);
  });

  it("replaces relegated D4 clubs with deterministic D5 pool candidates in gameplay mode", () => {
    const relegatedClub = FICTIONAL_LEAGUES[K4_LEAGUE_ID].clubs.at(-1)!;
    const status: PromotionRelegationStatus = {
      isResolved: true,
      promotedClubIds: [],
      relegatedClubIds: [relegatedClub.id],
      note: "test",
    };

    const rolled = applySeasonRollover({
      leagues: FICTIONAL_LEAGUES,
      clubs: Object.fromEntries(getAllClubs().map((club) => [club.id, club])),
      promotionRelegation: status,
      nextSeasonStartYear: 2028,
      k4K5Mode: "gameplay_relegation_enabled",
    });
    const promotedPoolClubId = rolled.promotedPoolClubIds[0];
    const nextSeasonD4Fixtures = generateLeagueFixtures(rolled.leagues[K4_LEAGUE_ID], {
      seasonNumber: 2,
      seasonStartDate: "2028-02-26T12:00:00.000Z",
    });

    expect(rolled.relegatedOutClubIds).toContain(relegatedClub.id);
    expect(rolled.archivedNonPlayableClubs.map((club) => club.id)).toContain(relegatedClub.id);
    expect(rolled.archivedNonPlayableClubs.find((club) => club.id === relegatedClub.id)?.lastPoolResult).toContain("4부 강등");
    expect(rolled.promotedPoolClubIds).toHaveLength(1);
    expect(promotedPoolClubId).toBeDefined();
    expect(rolled.clubs[promotedPoolClubId]).toBeDefined();
    expect(rolled.leagues[K4_LEAGUE_ID].clubs).toHaveLength(18);
    expect(rolled.clubs[relegatedClub.id]).toBeUndefined();
    expect(
      nextSeasonD4Fixtures.some(
        (fixture) => fixture.homeClubId === promotedPoolClubId || fixture.awayClubId === promotedPoolClubId,
      ),
    ).toBe(true);
  });

  it("keeps D4 membership unchanged when K4-K5 relegation is realistically suspended", () => {
    const relegatedClub = FICTIONAL_LEAGUES[K4_LEAGUE_ID].clubs.at(-1)!;
    const status: PromotionRelegationStatus = {
      isResolved: true,
      promotedClubIds: [],
      relegatedClubIds: [relegatedClub.id],
      note: "test",
    };

    const rolled = applySeasonRollover({
      leagues: FICTIONAL_LEAGUES,
      clubs: Object.fromEntries(getAllClubs().map((club) => [club.id, club])),
      promotionRelegation: status,
      nextSeasonStartYear: 2028,
      k4K5Mode: "realistic_suspended",
    });

    expect(rolled.relegatedOutClubIds).toHaveLength(0);
    expect(rolled.promotedPoolClubIds).toHaveLength(0);
    expect(rolled.clubs[relegatedClub.id]).toBeDefined();
    expect(rolled.leagues[K4_LEAGUE_ID].clubs.map((club) => club.id)).toContain(relegatedClub.id);
  });

  it("makes the player a free agent when their D4 club drops below playable football", () => {
    const relegatedClub = FICTIONAL_LEAGUES[K4_LEAGUE_ID].clubs.at(-1)!;
    const roll = generatePlayerRoll("d4-free-agent");
    const career = createNewCareer({
      name: "테스트 선수",
      nationality: "대한민국",
      clubId: relegatedClub.id,
      position: roll.recommendations[0].position,
      roll,
    });
    const completedCareer = {
      ...career,
      season: {
        ...career.season,
        isComplete: true,
        promotionRelegation: {
          isResolved: true,
          promotedClubIds: [],
          relegatedClubIds: [relegatedClub.id],
          note: "test",
        },
      },
    };

    const nextSeason = startNextSeason(completedCareer);

    expect(nextSeason.playerContractStatus).toBe("freeAgent");
    expect(nextSeason.currentClubId).toBeNull();
    expect(nextSeason.transferOffers.length).toBeGreaterThan(0);
    expect(nextSeason.unifiedFeed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "자유계약 신분 전환",
          body: "소속팀이 비활성 리그로 강등되어 자유계약 신분이 되었습니다.",
        }),
      ]),
    );
    expect(nextSeason.careerHistory.map((entry) => entry.clubId)).toContain(relegatedClub.id);
  });

  it("enforces the fixed viewport CSS contract", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/global.css"), "utf8");

    expect(css).toContain("html,\nbody,\n#root");
    expect(css).toContain("height: 100%");
    expect(css).toContain("overflow: hidden");
    expect(css).toContain(".app-shell-main");
    expect(css).toContain("min-height: 0");
    expect(css).toContain(".table-scroll");
    expect(css).toContain(".paginated-table");
    expect(css).toContain(".fixed-panel");
    expect(css).toContain(".section-tab-bar");
    expect(css).toContain(".team-detail-content");
    expect(css).toContain(".creation-step-layout");
    expect(css).toContain(".creation-left-rail");
    expect(css).toContain(".creation-step-content");
    expect(css).toContain(".recommendation.fit-poor");
    expect(css).toContain(".recommendation.fit-weak");
    expect(css).toContain(".recommendation.fit-average");
    expect(css).toContain(".recommendation.fit-good");
    expect(css).toContain(".recommendation.fit-excellent");
    expect(css).toContain(".match-header");
    expect(css).toContain(".match-fixed-grid");
    expect(css).toContain(".status-marker");
    expect(CREATION_TEAM_PAGE_SIZE).toBeLessThanOrEqual(8);
  });
});
