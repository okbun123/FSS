import type { CareerState } from "../domain/types";

export type AppScreen = "start" | "playerCreation" | "dashboard";

export function getInitialScreen(_career: CareerState | null): AppScreen {
  return "start";
}
