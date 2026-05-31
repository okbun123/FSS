import { deriveDominantFoot } from "../domain/player";
import { FICTIONAL_LEAGUES, K1_LEAGUE_ID, K2_LEAGUE_ID, getClubById } from "../data/fictionalLeagues";
import type { CareerState } from "../domain/types";
import { calculateMarketValue, calculateOverall } from "../game/overall";
import { recommendPositions } from "../game/positionRecommendation";

export const CAREER_SAVE_KEY = "football-career-sim.career-state";
export const CURRENT_SAVE_VERSION = 2;

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

  return (
    isRecord(value.player) &&
    typeof value.player.name === "string" &&
    typeof value.player.leftFoot === "number" &&
    typeof value.player.rightFoot === "number" &&
    isRecord(value.player.attributes) &&
    isRecord(value.season) &&
    typeof value.season.currentMonth === "number" &&
    Array.isArray(value.season.fixtures) &&
    isRecord(value.leagues)
  );
}

function normalizeCareerState(careerState: CareerState): CareerState {
  const selectedPosition = careerState.player.selectedPosition ?? careerState.player.position ?? "ST";
  const form = careerState.form ?? careerState.player.form ?? 50;
  const condition = careerState.condition ?? careerState.player.condition ?? 80;
  const fatigue = careerState.fatigue ?? careerState.player.fatigue ?? 10;
  const reputation = careerState.reputation ?? careerState.player.reputation ?? 25;
  const coachTrust = careerState.coachTrust ?? careerState.player.coachTrust ?? 40;
  const playerBase = {
    ...careerState.player,
    selectedPosition,
    position: selectedPosition,
    recommendedPositions:
      careerState.player.recommendedPositions ??
      recommendPositions({
        attributes: careerState.player.attributes,
        leftFoot: careerState.player.leftFoot,
        rightFoot: careerState.player.rightFoot,
        potential: careerState.player.potential,
      }),
    dominantFoot:
      careerState.player.dominantFoot ??
      deriveDominantFoot(careerState.player.leftFoot, careerState.player.rightFoot),
    form,
    condition,
    fatigue,
    reputation,
    coachTrust,
  };
  const OVR = calculateOverall(playerBase, selectedPosition);
  const player = {
    ...playerBase,
    OVR,
    marketValue: careerState.player.marketValue ?? calculateMarketValue({ ...playerBase, OVR }, reputation),
  };

  return {
    ...careerState,
    saveVersion: CURRENT_SAVE_VERSION,
    player,
    leagues: FICTIONAL_LEAGUES,
    form,
    condition,
    fatigue,
    reputation,
    coachTrust,
    careerHistory: careerState.careerHistory ?? [],
    transferOffers: careerState.transferOffers ?? [],
    notices: careerState.notices ?? [],
    eventLog: careerState.eventLog ?? [],
    monthlyDevelopmentLog: careerState.monthlyDevelopmentLog ?? [],
    injury: careerState.injury ?? { severity: "healthy", monthsRemaining: 0 },
  };
}

function parseSaveFile(value: unknown): CareerSaveLoadResult {
  if (!isRecord(value)) {
    return {
      status: "invalid",
      message: "저장 데이터를 읽을 수 없습니다. 저장을 삭제하고 새 커리어를 시작해 주세요.",
    };
  }

  if (typeof value.saveVersion !== "number") {
    return {
      status: "invalid",
      message: "이전 형식의 저장 데이터입니다. 저장을 삭제하고 새 커리어를 시작해 주세요.",
    };
  }

  if (value.saveVersion !== CURRENT_SAVE_VERSION) {
    return {
      status: "unsupportedVersion",
      foundVersion: value.saveVersion,
      message:
        "주간 MVP 저장은 월간 커리어 시스템과 호환되지 않습니다. 저장을 삭제하고 새 커리어를 시작해 주세요.",
    };
  }

  if (typeof value.savedAt !== "string" || !hasValidCareerShape(value.careerState)) {
    return {
      status: "invalid",
      message: "저장 데이터가 손상되었습니다. 저장을 삭제하고 새 커리어를 시작해 주세요.",
    };
  }

  if (
    !isRecord(value.careerState.leagues[K1_LEAGUE_ID]) ||
    !isRecord(value.careerState.leagues[K2_LEAGUE_ID]) ||
    !getClubById(value.careerState.player.clubId)
  ) {
    return {
      status: "unsupportedVersion",
      foundVersion: value.saveVersion,
      message:
        "리그 구조가 코리아 프리미어 1 / 코리아 챌린지 2로 변경되어 이전 저장과 호환되지 않습니다. 저장을 삭제하고 새 커리어를 시작해 주세요.",
    };
  }

  return {
    status: "loaded",
    save: {
      saveVersion: CURRENT_SAVE_VERSION,
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
    careerState: normalizeCareerState(careerState),
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
      message: "저장 데이터를 읽을 수 없습니다. 저장을 삭제하고 새 커리어를 시작해 주세요.",
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
