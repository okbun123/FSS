import type {
  CareerState,
  Club,
  ClubSeasonRecord,
  ClubTrainingFacilities,
  Competition,
  Fixture,
  League,
  LeagueTier,
} from "./types";

export type TeamFormOutcome = "W" | "D" | "L";
export type TeamLeagueMovement = "promoted" | "relegated" | "stayed" | "unknown";

export interface TeamRecentMatch {
  fixtureId: string;
  date: string;
  outcome: TeamFormOutcome;
  score: string;
  opponentClubId: string;
  opponentName: string;
  competitionId: string;
  competitionName: string;
}

export interface TeamLastSeasonResult {
  record?: ClubSeasonRecord;
  fallback?: string;
  seasonNumber?: number;
  finalLeaguePosition?: number;
  predictedFinish?: number;
  movement: TeamLeagueMovement;
  movementLabel: string;
  cupResult?: string;
  continentalResult?: string;
}

export interface TeamCompetitionsEntered {
  league: string;
  domesticCups: string[];
  continentalCups: string[];
}

export interface TeamDetail {
  clubId: string;
  name: string;
  shortName: string;
  league: string;
  reputation: number;
  budgetLevel: number;
  squadStrength: number;
  youthOpportunity: number;
  trainingFacilitiesSummary: string;
  recentMatches: TeamRecentMatch[];
  lastSeasonResult: TeamLastSeasonResult;
  predictedFinish: number;
  competitionsEntered: TeamCompetitionsEntered;
}

export const MISSING_LAST_SEASON_RESULT_TEXT = "지난 시즌 기록이 아직 없습니다.";

const FACILITY_LABELS: Array<[keyof ClubTrainingFacilities, string]> = [
  ["technicalTraining", "기술 훈련"],
  ["physicalTraining", "피지컬 훈련"],
  ["tacticalTraining", "전술 훈련"],
  ["mentalTraining", "멘탈 훈련"],
  ["youthDevelopment", "유스 육성"],
  ["medicalSupport", "메디컬 지원"],
];

function getClub(career: CareerState, clubId: string): Club | undefined {
  return (
    career.clubs[clubId] ??
    Object.values(career.leagues)
      .flatMap((league) => league.clubs)
      .find((club) => club.id === clubId)
  );
}

function getLeague(career: CareerState, leagueId: LeagueTier): League | undefined {
  return career.leagues[leagueId];
}

function getFixtureCompetition(career: CareerState, fixture: Fixture): Competition | undefined {
  return career.competitions[fixture.competitionId];
}

function getCompetitionName(career: CareerState, fixture: Fixture): string {
  return getFixtureCompetition(career, fixture)?.name ?? career.leagues[fixture.leagueId]?.name ?? fixture.competitionId;
}

function isTeamFixture(fixture: Fixture, clubId: string): boolean {
  return fixture.homeClubId === clubId || fixture.awayClubId === clubId;
}

function getTeamGoals(fixture: Fixture, clubId: string): { for: number; against: number } | undefined {
  if (!fixture.result) {
    return undefined;
  }

  return fixture.homeClubId === clubId
    ? { for: fixture.result.homeGoals, against: fixture.result.awayGoals }
    : { for: fixture.result.awayGoals, against: fixture.result.homeGoals };
}

function getOutcome(goalsFor: number, goalsAgainst: number): TeamFormOutcome {
  if (goalsFor > goalsAgainst) {
    return "W";
  }

  if (goalsFor < goalsAgainst) {
    return "L";
  }

  return "D";
}

function sortRecentFixtures(left: Fixture, right: Fixture): number {
  return (
    right.date.localeCompare(left.date) ||
    right.round - left.round ||
    right.id.localeCompare(left.id)
  );
}

export function getRecentTeamMatches(
  career: CareerState,
  clubId: string,
  limit = 5,
): TeamRecentMatch[] {
  return [...career.fixtures, ...(career.season.fixtures === career.fixtures ? [] : career.season.fixtures)]
    .filter((fixture, index, fixtures) => fixtures.findIndex((candidate) => candidate.id === fixture.id) === index)
    .filter((fixture) => fixture.status === "played" && fixture.result && isTeamFixture(fixture, clubId))
    .sort(sortRecentFixtures)
    .slice(0, limit)
    .map((fixture) => {
      const goals = getTeamGoals(fixture, clubId) ?? { for: 0, against: 0 };
      const opponentClubId = fixture.homeClubId === clubId ? fixture.awayClubId : fixture.homeClubId;
      const opponent = getClub(career, opponentClubId);

      return {
        fixtureId: fixture.id,
        date: fixture.date,
        outcome: getOutcome(goals.for, goals.against),
        score: `${goals.for}-${goals.against}`,
        opponentClubId,
        opponentName: opponent?.name ?? opponentClubId,
        competitionId: fixture.competitionId,
        competitionName: getCompetitionName(career, fixture),
      };
    });
}

function getFacilityAverage(facilities: ClubTrainingFacilities): number {
  const total = FACILITY_LABELS.reduce((sum, [key]) => sum + facilities[key], 0);
  return Math.round(total / FACILITY_LABELS.length);
}

export function summarizeTrainingFacilities(facilities: ClubTrainingFacilities): string {
  const average = getFacilityAverage(facilities);
  const [bestKey, bestLabel] = [...FACILITY_LABELS].sort(
    ([leftKey], [rightKey]) => facilities[rightKey] - facilities[leftKey],
  )[0];
  const grade = average >= 85 ? "최상" : average >= 75 ? "우수" : average >= 65 ? "보통" : "성장형";

  return `${grade} · 평균 ${average} · 강점 ${bestLabel} ${facilities[bestKey]}`;
}

function predictionScore(club: Club): number {
  return (
    club.squadStrength * 0.52 +
    club.reputation * 0.24 +
    club.budgetLevel * 0.14 +
    getFacilityAverage(club.trainingFacilities) * 0.1
  );
}

export function predictTeamFinish(career: CareerState, leagueId: LeagueTier, clubId: string): number {
  const league = getLeague(career, leagueId);

  if (!league) {
    return 0;
  }

  const predictedTable = league.clubs
    .map((leagueClub) => career.clubs[leagueClub.id] ?? leagueClub)
    .sort(
      (left, right) =>
        predictionScore(right) - predictionScore(left) ||
        right.reputation - left.reputation ||
        left.name.localeCompare(right.name, "ko"),
    );

  return predictedTable.findIndex((club) => club.id === clubId) + 1;
}

function getLatestSeasonRecord(club: Club, currentSeasonNumber: number): ClubSeasonRecord | undefined {
  return [...club.seasonRecords]
    .filter((record) => record.seasonNumber < currentSeasonNumber)
    .sort((left, right) => right.seasonNumber - left.seasonNumber)[0];
}

function getMovementFromRecord(
  career: CareerState,
  club: Club,
  record: ClubSeasonRecord,
): TeamLeagueMovement {
  const recordWithMovement = record as ClubSeasonRecord & { leagueMovement?: TeamLeagueMovement };

  if (recordWithMovement.leagueMovement) {
    return recordWithMovement.leagueMovement;
  }

  const previousLevel = career.leagues[record.leagueId]?.level;
  const currentLevel = career.leagues[club.leagueId]?.level;

  if (!previousLevel || !currentLevel) {
    return record.leagueId === club.leagueId ? "stayed" : "unknown";
  }

  if (currentLevel < previousLevel) {
    return "promoted";
  }

  if (currentLevel > previousLevel) {
    return "relegated";
  }

  return "stayed";
}

function movementLabel(movement: TeamLeagueMovement): string {
  switch (movement) {
    case "promoted":
      return "승격";
    case "relegated":
      return "강등";
    case "stayed":
      return "잔류";
    default:
      return "기록 없음";
  }
}

export function getLastSeasonResult(career: CareerState, club: Club): TeamLastSeasonResult {
  const record = getLatestSeasonRecord(club, career.season.number);

  if (!record) {
    return {
      fallback: MISSING_LAST_SEASON_RESULT_TEXT,
      movement: "unknown",
      movementLabel: movementLabel("unknown"),
    };
  }

  const recordWithCups = record as ClubSeasonRecord & {
    cupResult?: string;
    continentalResult?: string;
  };
  const movement = getMovementFromRecord(career, club, record);

  return {
    record,
    seasonNumber: record.seasonNumber,
    finalLeaguePosition: record.leaguePosition,
    predictedFinish: record.predictedFinish,
    movement,
    movementLabel: movementLabel(movement),
    cupResult: recordWithCups.cupResult,
    continentalResult: recordWithCups.continentalResult,
  };
}

function isContinentalCompetition(competition: Competition): boolean {
  const normalizedName = competition.name.toLowerCase();
  return (
    normalizedName.includes("continental") ||
    normalizedName.includes("asia") ||
    normalizedName.includes("champions") ||
    competition.name.includes("대륙") ||
    competition.name.includes("아시아") ||
    competition.name.includes("챔피언")
  );
}

function competitionHasTeam(career: CareerState, competition: Competition, clubId: string): boolean {
  const fixtureIds = new Set(competition.fixtureIds);

  return career.fixtures.some(
    (fixture) =>
      fixtureIds.has(fixture.id) &&
      fixture.competitionId === competition.id &&
      isTeamFixture(fixture, clubId),
  );
}

export function getCompetitionsEntered(
  career: CareerState,
  club: Club,
  league: League,
): TeamCompetitionsEntered {
  const competitions = Object.values(career.competitions).filter((competition) =>
    competitionHasTeam(career, competition, club.id),
  );
  const cupCompetitions = competitions.filter((competition) => competition.type === "cup");

  return {
    league: league.name,
    domesticCups: cupCompetitions
      .filter((competition) => !isContinentalCompetition(competition))
      .map((competition) => competition.name),
    continentalCups: cupCompetitions
      .filter(isContinentalCompetition)
      .map((competition) => competition.name),
  };
}

export function getTeamDetail(career: CareerState, clubId: string): TeamDetail | undefined {
  const club = getClub(career, clubId);

  if (!club) {
    return undefined;
  }

  const league = getLeague(career, club.leagueId);

  if (!league) {
    return undefined;
  }

  return {
    clubId: club.id,
    name: club.name,
    shortName: club.shortName,
    league: league.name,
    reputation: club.reputation,
    budgetLevel: club.budgetLevel,
    squadStrength: club.squadStrength,
    youthOpportunity: club.youthOpportunity,
    trainingFacilitiesSummary: summarizeTrainingFacilities(club.trainingFacilities),
    recentMatches: getRecentTeamMatches(career, club.id),
    lastSeasonResult: getLastSeasonResult(career, club),
    predictedFinish: predictTeamFinish(career, club.leagueId, club.id),
    competitionsEntered: getCompetitionsEntered(career, club, league),
  };
}
