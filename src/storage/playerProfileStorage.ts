import type { PlayerProfile } from "../domain/player";

const PLAYER_PROFILE_KEY = "football-career-sim.player-profile";

export function loadPlayerProfile(): PlayerProfile | null {
  try {
    const storedProfile = localStorage.getItem(PLAYER_PROFILE_KEY);
    return storedProfile ? (JSON.parse(storedProfile) as PlayerProfile) : null;
  } catch {
    return null;
  }
}

export function savePlayerProfile(player: PlayerProfile): void {
  localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(player));
}

export function clearSavedPlayerProfile(): void {
  localStorage.removeItem(PLAYER_PROFILE_KEY);
}
