import { WEEKLY_ACTIONS } from "../data/weeklyActions";
import type {
  AttributeFocus,
  AttributeGrowthEntry,
  Attributes,
  CareerEventLogEntry,
  CareerHistoryEntry,
  CareerState,
  Club,
  League,
  Season,
  SeasonBaseline,
  SeasonStats,
  SeasonSummary,
} from "../domain/types";
import { ATTRIBUTE_LABELS, getAttributeValue } from "./growth";
import { generateSeasonSchedule } from "./schedule";

interface StartNextSeasonOptions {
  completedAt?: string;
}

type SeasonBaselineCareer = Pick<
  CareerState,
  "season" | "player" | "coachTrust" | "fanSupport" | "reputation"
>;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, precision = 2): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

function cloneAttributes(attributes: Attributes): Attributes {
  return {
    technical: { ...attributes.technical },
    physical: { ...attributes.physical },
    mental: { ...attributes.mental },
    career: { ...attributes.career },
  };
}

function getPlayerSeasonMatches(career: CareerState) {
  return career.season.matches.filter(
    (match) =>
      match.homeClubId === career.player.clubId || match.awayClubId === career.player.clubId,
  );
}

function getDeterministicSwing(clubId: string, seasonNumber: number): number {
  const seed = [...clubId].reduce((total, char) => total + char.charCodeAt(0), 0);
  return ((seed + seasonNumber * 7) % 9) - 4;
}

function getPlayerClubScore(career: CareerState, club: Club): number {
  const baseline = career.seasonBaseline ?? createSeasonBaseline(career);
  const stats = career.seasonStats;
  const ratingBonus = stats.averageRating > 0 ? (stats.averageRating - 6.2) * 7 : 0;
  const contributionBonus =
    stats.goals * 1.2 + stats.assists + stats.appearances * 0.25 + ratingBonus;
  const trustBonus = (career.coachTrust - baseline.coachTrust) * 0.35;

  return club.strength * 1.25 + club.reputation * 0.55 + contributionBonus + trustBonus;
}

function getClubScore(career: CareerState, club: Club): number {
  const baseScore =
    club.strength * 1.25 +
    club.reputation * 0.55 +
    getDeterministicSwing(club.id, career.season.number);

  if (club.id !== career.player.clubId) {
    return baseScore;
  }

  return getPlayerClubScore(career, club);
}

function createHistoryEntry(
  summary: SeasonSummary,
  completedAt: string,
): CareerHistoryEntry {
  return {
    ...summary,
    id: `season-${summary.seasonNumber}-history`,
    completedAt,
  };
}

function adjustClubsForNextSeason(clubs: Club[], nextSeasonNumber: number): Club[] {
  return clubs.map((club, index) => {
    const strengthSwing = ((nextSeasonNumber + index * 2) % 5) - 2;
    const reputationSwing = ((nextSeasonNumber + index) % 3) - 1;

    return {
      ...club,
      strength: clamp(club.strength + strengthSwing, 52, 78),
      reputation: clamp(club.reputation + reputationSwing, 50, 74),
    };
  });
}

function createNextSeasonEvent(
  nextSeasonNumber: number,
  completedAt: string,
): CareerEventLogEntry {
  return {
    id: `season-${nextSeasonNumber}-started`,
    week: 1,
    title: "다음 시즌 시작",
    description: `${nextSeasonNumber}번째 시즌 일정이 생성되었습니다.`,
    createdAt: completedAt,
  };
}

export function createEmptySeasonStats(): SeasonStats {
  return {
    appearances: 0,
    minutesPlayed: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    keyPasses: 0,
    tackles: 0,
    turnovers: 0,
    averageRating: 0,
    keyMomentsWon: 0,
  };
}

export function createSeasonBaseline(career: SeasonBaselineCareer): SeasonBaseline {
  return {
    seasonNumber: career.season.number,
    coachTrust: career.coachTrust,
    fanSupport: career.fanSupport,
    reputation: career.reputation,
    attributes: cloneAttributes(career.player.attributes),
  };
}

export function isSeasonComplete(career: CareerState): boolean {
  const playerMatches = getPlayerSeasonMatches(career);

  return playerMatches.length > 0 && playerMatches.every((match) => match.status === "played");
}

export function calculateLeaguePosition(career: CareerState): number {
  const rankedClubs = [...career.league.clubs].sort(
    (left, right) => getClubScore(career, right) - getClubScore(career, left),
  );

  return rankedClubs.findIndex((club) => club.id === career.player.clubId) + 1;
}

export function createAttributeGrowthSummary(career: CareerState): AttributeGrowthEntry[] {
  const baseline = career.seasonBaseline ?? createSeasonBaseline(career);
  const attributeKeys = Object.keys(ATTRIBUTE_LABELS) as AttributeFocus[];

  return attributeKeys
    .map((attribute) => {
      const before = getAttributeValue(baseline.attributes, attribute);
      const after = getAttributeValue(career.player.attributes, attribute);
      const amount = round(after - before);

      return {
        attribute,
        label: ATTRIBUTE_LABELS[attribute],
        before,
        after,
        amount,
      };
    })
    .filter((entry) => entry.amount > 0)
    .sort((left, right) => right.amount - left.amount);
}

export function createSeasonSummary(career: CareerState): SeasonSummary {
  const baseline = career.seasonBaseline ?? createSeasonBaseline(career);
  const playerClub = career.league.clubs.find((club) => club.id === career.player.clubId);

  return {
    seasonNumber: career.season.number,
    clubId: career.player.clubId,
    clubName: playerClub?.name ?? "소속 없음",
    leaguePosition: calculateLeaguePosition(career),
    appearances: career.seasonStats.appearances,
    goals: career.seasonStats.goals,
    assists: career.seasonStats.assists,
    averageRating: career.seasonStats.averageRating,
    coachTrustChange: career.coachTrust - baseline.coachTrust,
    fanSupportChange: career.fanSupport - baseline.fanSupport,
    reputationChange: career.reputation - baseline.reputation,
    attributeGrowthSummary: createAttributeGrowthSummary(career),
  };
}

export function startNextSeason(
  career: CareerState,
  options: StartNextSeasonOptions = {},
): CareerState {
  if (!isSeasonComplete(career)) {
    throw new Error("Cannot start the next season before all player matches are complete.");
  }

  const completedAt = options.completedAt ?? new Date().toISOString();
  const summary = createSeasonSummary(career);
  const nextSeasonNumber = career.season.number + 1;
  const adjustedClubs = adjustClubsForNextSeason(career.league.clubs, nextSeasonNumber);
  const nextSeason: Season = {
    id: `season-${nextSeasonNumber}`,
    number: nextSeasonNumber,
    leagueId: career.league.id,
    currentWeek: 1,
    totalWeeks: career.league.seasonWeeks,
    matches: generateSeasonSchedule(adjustedClubs, { seasonNumber: nextSeasonNumber }),
    isComplete: false,
  };
  const nextLeague: League = {
    ...career.league,
    clubs: adjustedClubs,
  };
  const nextCareerWithoutBaseline: CareerState = {
    ...career,
    player: {
      ...career.player,
      age: career.player.age + 1,
    },
    league: nextLeague,
    season: nextSeason,
    currentWeek: 1,
    condition: clamp(career.condition + 12, 65, 92),
    fatigue: clamp(career.fatigue - 22, 5, 35),
    form: clamp(Math.round(50 + (career.form - 50) * 0.25), 40, 62),
    weeklyActionCompleted: false,
    seasonStats: createEmptySeasonStats(),
    availableWeeklyActions: WEEKLY_ACTIONS,
    developmentLog: [],
    careerHistory: [
      ...(career.careerHistory ?? []),
      createHistoryEntry(summary, completedAt),
    ].slice(-12),
    eventLog: [
      ...(career.eventLog ?? []),
      createNextSeasonEvent(nextSeasonNumber, completedAt),
    ].slice(-30),
    seasonBaseline: career.seasonBaseline,
  };

  return {
    ...nextCareerWithoutBaseline,
    seasonBaseline: createSeasonBaseline(nextCareerWithoutBaseline),
  };
}
