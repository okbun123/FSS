import { ScreenShell } from "../components/ScreenShell";

interface StartScreenProps {
  hasSavedCareer: boolean;
  savedAtLabel: string | null;
  saveError: string | null;
  saveMessage: string | null;
  onContinueCareer: () => void;
  onDeleteSave: () => void;
  onStartNewCareer: () => void;
}

export function StartScreen({
  hasSavedCareer,
  savedAtLabel,
  saveError,
  saveMessage,
  onContinueCareer,
  onDeleteSave,
  onStartNewCareer,
}: StartScreenProps) {
  const canDeleteSave = hasSavedCareer || Boolean(saveError);

  return (
    <ScreenShell
      eyebrow="커리어 시뮬레이션"
      title="풋볼 커리어"
      actions={
        <>
          <button
            className="primary-button"
            type="button"
            onClick={onContinueCareer}
            disabled={!hasSavedCareer}
          >
            이어하기
          </button>
          <button className="secondary-button" type="button" onClick={onStartNewCareer}>
            새 커리어 시작
          </button>
          {canDeleteSave ? (
            <button className="danger-button" type="button" onClick={onDeleteSave}>
              저장 삭제
            </button>
          ) : null}
        </>
      }
    >
      {saveError ? (
        <div className="save-alert" role="alert">
          <strong>저장 데이터를 불러오지 못했습니다.</strong>
          <p>{saveError}</p>
        </div>
      ) : null}

      {saveMessage ? (
        <div className="save-status" role="status">
          {saveMessage}
        </div>
      ) : null}

      <div className="start-grid" aria-label="게임 상태">
        <div>
          <strong>저장 상태</strong>
          <span>{hasSavedCareer ? "저장 있음" : "저장 없음"}</span>
        </div>
        <div>
          <strong>최근 저장</strong>
          <span>{savedAtLabel ?? "기록 없음"}</span>
        </div>
        <div>
          <strong>진행 방식</strong>
          <span>주간 선택</span>
        </div>
      </div>
    </ScreenShell>
  );
}
