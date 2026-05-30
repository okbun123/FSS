import type { CareerState } from "../domain/types";

export type AppScreen = "start" | "playerCreation" | "dashboard";

export function getInitialScreen(career: CareerState | null): AppScreen {
  return career ? "dashboard" : "start";
}
