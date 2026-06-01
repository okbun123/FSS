import type { K4K5Mode } from "./types";

export const DEFAULT_K4_K5_MODE = "gameplay_relegation_enabled" satisfies K4K5Mode;

export type LegacyLeagueMode = "realistic" | "gameplay";

export function resolveK4K5Mode(
  k4K5Mode?: K4K5Mode,
  legacyLeagueMode?: LegacyLeagueMode,
): K4K5Mode {
  if (k4K5Mode) {
    return k4K5Mode;
  }

  return legacyLeagueMode === "realistic"
    ? "realistic_suspended"
    : DEFAULT_K4_K5_MODE;
}

export function isK4K5RelegationEnabled(
  k4K5Mode?: K4K5Mode,
  legacyLeagueMode?: LegacyLeagueMode,
): boolean {
  return resolveK4K5Mode(k4K5Mode, legacyLeagueMode) === "gameplay_relegation_enabled";
}
