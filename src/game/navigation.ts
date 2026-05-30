import type { PlayerProfile } from "../domain/player";

export type AppScreen = "start" | "playerCreation" | "dashboard";

export function getInitialScreen(player: PlayerProfile | null): AppScreen {
  return player ? "dashboard" : "start";
}
