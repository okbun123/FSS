import { useMemo, useState } from "react";
import { StartScreen } from "./screens/StartScreen";
import { PlayerCreationScreen } from "./screens/PlayerCreationScreen";
import { CareerDashboardScreen } from "./screens/CareerDashboardScreen";
import type { CareerState } from "./domain/types";
import { type AppScreen, getInitialScreen } from "./game/navigation";
import {
  clearSavedCareerState,
  loadCareerState,
  saveCareerState,
} from "./storage/careerStorage";

export function App() {
  const initialCareer = useMemo(() => loadCareerState(), []);
  const [career, setCareer] = useState<CareerState | null>(initialCareer);
  const [screen, setScreen] = useState<AppScreen>(getInitialScreen(initialCareer));

  const startNewCareer = () => {
    setScreen("playerCreation");
  };

  const continueCareer = () => {
    if (career) {
      setScreen("dashboard");
    }
  };

  const createCareer = (createdCareer: CareerState) => {
    saveCareerState(createdCareer);
    setCareer(createdCareer);
    setScreen("dashboard");
  };

  const resetCareer = () => {
    clearSavedCareerState();
    setCareer(null);
    setScreen("start");
  };

  if (screen === "playerCreation") {
    return (
      <PlayerCreationScreen
        onBack={() => setScreen("start")}
        onCreateCareer={createCareer}
      />
    );
  }

  if (screen === "dashboard" && career) {
    return <CareerDashboardScreen career={career} onResetCareer={resetCareer} />;
  }

  return (
    <StartScreen
      hasSavedCareer={Boolean(career)}
      onContinueCareer={continueCareer}
      onStartNewCareer={startNewCareer}
    />
  );
}
