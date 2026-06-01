import type { LeagueTier } from "./types";

export const K1_LEAGUE_ID = "div1" satisfies LeagueTier;
export const K2_LEAGUE_ID = "div2" satisfies LeagueTier;
export const K3_LEAGUE_ID = "div3" satisfies LeagueTier;
export const K4_LEAGUE_ID = "div4" satisfies LeagueTier;

export const LEAGUE_IDS = [
  K1_LEAGUE_ID,
  K2_LEAGUE_ID,
  K3_LEAGUE_ID,
  K4_LEAGUE_ID,
] as const satisfies readonly LeagueTier[];

export const LEGACY_LEAGUE_ID_MAP: Record<string, LeagueTier> = {
  k1_fictional: K1_LEAGUE_ID,
  k2_fictional: K2_LEAGUE_ID,
  k3_fictional: K3_LEAGUE_ID,
  k4_fictional: K4_LEAGUE_ID,
};
