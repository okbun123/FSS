import { useMemo, useState } from "react";
import { StartScreen } from "./screens/StartScreen";
import { PlayerCreationScreen } from "./screens/PlayerCreationScreen";
import { CareerDashboardScreen } from "./screens/CareerDashboardScreen";
import type { PlayerProfile } from "./domain/player";
import { type AppScreen, getInitialScreen } from "./game/navigation";
import {
  clearSavedPlayerProfile,
  loadPlayerProfile,
  savePlayerProfile,
} from "./storage/playerProfileStorage";

export function App() {
  const initialPlayer = useMemo(() => loadPlayerProfile(), []);
  const [player, setPlayer] = useState<PlayerProfile | null>(initialPlayer);
  const [screen, setScreen] = useState<AppScreen>(getInitialScreen(initialPlayer));

  const startNewCareer = () => {
    setScreen("playerCreation");
  };

  const continueCareer = () => {
    if (player) {
      setScreen("dashboard");
    }
  };

  const createPlayer = (createdPlayer: PlayerProfile) => {
    savePlayerProfile(createdPlayer);
    setPlayer(createdPlayer);
    setScreen("dashboard");
  };

  const resetCareer = () => {
    clearSavedPlayerProfile();
    setPlayer(null);
    setScreen("start");
  };

  if (screen === "playerCreation") {
    return (
      <PlayerCreationScreen
        onBack={() => setScreen("start")}
        onCreatePlayer={createPlayer}
      />
    );
  }

  if (screen === "dashboard" && player) {
    return <CareerDashboardScreen player={player} onResetCareer={resetCareer} />;
  }

  return (
    <StartScreen
      hasSavedCareer={Boolean(player)}
      onContinueCareer={continueCareer}
      onStartNewCareer={startNewCareer}
    />
  );
}
