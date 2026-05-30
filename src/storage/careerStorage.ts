import type { CareerState } from "../domain/types";

const CAREER_STATE_KEY = "football-career-sim.career-state";

export function loadCareerState(): CareerState | null {
  try {
    const storedCareer = localStorage.getItem(CAREER_STATE_KEY);
    return storedCareer ? (JSON.parse(storedCareer) as CareerState) : null;
  } catch {
    return null;
  }
}

export function saveCareerState(career: CareerState): void {
  localStorage.setItem(CAREER_STATE_KEY, JSON.stringify(career));
}

export function clearSavedCareerState(): void {
  localStorage.removeItem(CAREER_STATE_KEY);
}
