import { useMemo, useState } from "react";
import { StartScreen } from "./screens/StartScreen";
import { PlayerCreationScreen } from "./screens/PlayerCreationScreen";
import { CareerDashboardScreen } from "./screens/CareerDashboardScreen";
import type { CareerState } from "./domain/types";
import { type AppScreen, getInitialScreen } from "./game/navigation";
import {
  clearSavedCareerState,
  loadCareerSave,
  saveCareerState,
} from "./storage/careerStorage";

function formatSavedAt(savedAt: string | null): string | null {
  if (!savedAt) {
    return null;
  }

  const savedDate = new Date(savedAt);

  if (Number.isNaN(savedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(savedDate);
}

export function App() {
  const initialSave = useMemo(() => loadCareerSave(), []);
  const initialCareer = initialSave.status === "loaded" ? initialSave.save.careerState : null;
  const initialSavedAt = initialSave.status === "loaded" ? initialSave.save.savedAt : null;
  const initialSaveError =
    initialSave.status === "invalid" || initialSave.status === "unsupportedVersion"
      ? initialSave.message
      : null;

  const [career, setCareer] = useState<CareerState | null>(initialCareer);
  const [screen, setScreen] = useState<AppScreen>(getInitialScreen(initialCareer));
  const [savedAt, setSavedAt] = useState<string | null>(initialSavedAt);
  const [saveError, setSaveError] = useState<string | null>(initialSaveError);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const startNewCareer = () => {
    setSaveMessage(null);
    setScreen("playerCreation");
  };

  const continueCareer = () => {
    if (career) {
      setSaveMessage(null);
      setScreen("dashboard");
    }
  };

  const saveCareer = (careerToSave: CareerState) => {
    const saveFile = saveCareerState(careerToSave);
    setSavedAt(saveFile.savedAt);
    setSaveError(null);
    setSaveMessage("저장되었습니다.");
  };

  const createCareer = (createdCareer: CareerState) => {
    try {
      saveCareer(createdCareer);
      setCareer(createdCareer);
      setScreen("dashboard");
    } catch {
      setCareer(createdCareer);
      setSaveError("저장을 완료하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.");
      setSaveMessage(null);
      setScreen("dashboard");
    }
  };

  const saveCurrentCareer = () => {
    if (!career) {
      return;
    }

    try {
      saveCareer(career);
    } catch {
      setSaveError("저장을 완료하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.");
      setSaveMessage(null);
    }
  };

  const updateCareer = (updatedCareer: CareerState) => {
    setCareer(updatedCareer);
    setSaveMessage(null);
  };

  const deleteSave = () => {
    clearSavedCareerState();
    setCareer(null);
    setSavedAt(null);
    setSaveError(null);
    setSaveMessage("저장을 삭제했습니다.");
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
    return (
      <CareerDashboardScreen
        career={career}
        savedAtLabel={formatSavedAt(savedAt)}
        saveError={saveError}
        saveMessage={saveMessage}
        onDeleteSave={deleteSave}
        onCareerChange={updateCareer}
        onSaveCareer={saveCurrentCareer}
      />
    );
  }

  return (
    <StartScreen
      hasSavedCareer={Boolean(career)}
      savedAtLabel={formatSavedAt(savedAt)}
      saveError={saveError}
      saveMessage={saveMessage}
      onContinueCareer={continueCareer}
      onDeleteSave={deleteSave}
      onStartNewCareer={startNewCareer}
    />
  );
}
