import type { CareerState } from "../domain/types";
import { WEEKLY_ACTIONS } from "../data/weeklyActions";
import { createSeasonBaseline } from "../game/season";

export const CAREER_SAVE_KEY = "football-career-sim.career-state";
export const CURRENT_SAVE_VERSION = 1;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CareerSaveFile {
  saveVersion: number;
  savedAt: string;
  careerState: CareerState;
}

export type CareerSaveLoadResult =
  | { status: "empty" }
  | { status: "loaded"; save: CareerSaveFile }
  | { status: "invalid"; message: string }
  | { status: "unsupportedVersion"; message: string; foundVersion: number };

function getBrowserStorage(): StorageLike | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  return localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValidCareerShape(value: unknown): value is CareerState {
  if (!isRecord(value)) {
    return false;
  }

  const player = value.player;
  const season = value.season;
  const league = value.league;

  return (
    isRecord(player) &&
    typeof player.name === "string" &&
    typeof player.clubId === "string" &&
    isRecord(season) &&
    Array.isArray(season.matches) &&
    isRecord(league) &&
    Array.isArray(league.clubs) &&
    typeof value.currentWeek === "number"
  );
}

function normalizeCareerState(careerState: CareerState): CareerState {
  const hasSeasonBaselineClub =
    typeof careerState.seasonBaseline?.clubId === "string" &&
    typeof careerState.seasonBaseline?.clubName === "string";
  const seasonStats = {
    appearances: careerState.seasonStats.appearances,
    minutesPlayed: careerState.seasonStats.minutesPlayed ?? 0,
    goals: careerState.seasonStats.goals,
    assists: careerState.seasonStats.assists,
    shots: careerState.seasonStats.shots ?? 0,
    keyPasses: careerState.seasonStats.keyPasses ?? 0,
    tackles: careerState.seasonStats.tackles ?? 0,
    turnovers: careerState.seasonStats.turnovers ?? 0,
    averageRating: careerState.seasonStats.averageRating,
    keyMomentsWon: careerState.seasonStats.keyMomentsWon,
  };

  const normalizedCareer: CareerState = {
    ...careerState,
    player: {
      ...careerState.player,
      potential: careerState.player.potential ?? 84,
    },
    tacticalFit: careerState.tacticalFit ?? 42,
    salary: careerState.salary ?? 900,
    contractYearsLeft: careerState.contractYearsLeft ?? 2,
    squadRole: careerState.squadRole ?? "prospect",
    weeklyActionCompleted: careerState.weeklyActionCompleted ?? false,
    seasonStats,
    availableWeeklyActions: WEEKLY_ACTIONS,
    eventLog: careerState.eventLog ?? [
      {
        id: `week-${careerState.currentWeek}-loaded-save`,
        week: careerState.currentWeek,
        title: "저장 불러오기",
        description: "기존 저장 데이터를 불러왔습니다.",
        createdAt: new Date(0).toISOString(),
      },
    ],
    developmentLog: careerState.developmentLog ?? [],
    careerHistory: careerState.careerHistory ?? [],
    seasonOffers: careerState.seasonOffers ?? [],
    acceptedContractOfferId: careerState.acceptedContractOfferId,
    rejectedContractOfferIds: careerState.rejectedContractOfferIds ?? [],
    seasonBaseline: hasSeasonBaselineClub
      ? careerState.seasonBaseline
      : createSeasonBaseline(careerState),
  };

  return {
    ...normalizedCareer,
    seasonBaseline: hasSeasonBaselineClub
      ? careerState.seasonBaseline
      : createSeasonBaseline(normalizedCareer),
  };
}

function parseSaveFile(value: unknown): CareerSaveLoadResult {
  if (!isRecord(value)) {
    return {
      status: "invalid",
      message: "저장 데이터를 읽을 수 없습니다. 저장을 삭제한 뒤 새로 시작할 수 있습니다.",
    };
  }

  if (typeof value.saveVersion !== "number") {
    return {
      status: "invalid",
      message: "이전 형식의 저장 데이터입니다. 저장을 삭제한 뒤 새로 시작할 수 있습니다.",
    };
  }

  if (value.saveVersion !== CURRENT_SAVE_VERSION) {
    return {
      status: "unsupportedVersion",
      foundVersion: value.saveVersion,
      message: "지원하지 않는 저장 버전입니다. 저장을 삭제한 뒤 새로 시작할 수 있습니다.",
    };
  }

  if (typeof value.savedAt !== "string" || !hasValidCareerShape(value.careerState)) {
    return {
      status: "invalid",
      message: "저장 데이터가 손상되었습니다. 저장을 삭제한 뒤 새로 시작할 수 있습니다.",
    };
  }

  return {
    status: "loaded",
    save: {
      saveVersion: value.saveVersion,
      savedAt: value.savedAt,
      careerState: normalizeCareerState(value.careerState),
    },
  };
}

export function createCareerSaveFile(
  careerState: CareerState,
  savedAt: Date = new Date(),
): CareerSaveFile {
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    savedAt: savedAt.toISOString(),
    careerState,
  };
}

export function loadCareerSave(storage: StorageLike | null = getBrowserStorage()): CareerSaveLoadResult {
  if (!storage) {
    return { status: "empty" };
  }

  const storedCareer = storage.getItem(CAREER_SAVE_KEY);

  if (!storedCareer) {
    return { status: "empty" };
  }

  try {
    return parseSaveFile(JSON.parse(storedCareer) as unknown);
  } catch {
    return {
      status: "invalid",
      message: "저장 데이터를 읽을 수 없습니다. 저장을 삭제한 뒤 새로 시작할 수 있습니다.",
    };
  }
}

export function saveCareerState(
  careerState: CareerState,
  storage: StorageLike | null = getBrowserStorage(),
  savedAt: Date = new Date(),
): CareerSaveFile {
  if (!storage) {
    throw new Error("Local storage is not available.");
  }

  const saveFile = createCareerSaveFile(careerState, savedAt);
  storage.setItem(CAREER_SAVE_KEY, JSON.stringify(saveFile));
  return saveFile;
}

export function clearSavedCareerState(storage: StorageLike | null = getBrowserStorage()): void {
  storage?.removeItem(CAREER_SAVE_KEY);
}
