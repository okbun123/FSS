import { ScreenShell } from "../components/ScreenShell";

interface StartScreenProps {
  hasSavedCareer: boolean;
  onContinueCareer: () => void;
  onStartNewCareer: () => void;
}

export function StartScreen({
  hasSavedCareer,
  onContinueCareer,
  onStartNewCareer,
}: StartScreenProps) {
  return (
    <ScreenShell
      eyebrow="커리어 시뮬레이션"
      title="풋볼 커리어"
      actions={
        <>
          <button className="primary-button" type="button" onClick={onStartNewCareer}>
            새 커리어 시작
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={onContinueCareer}
            disabled={!hasSavedCareer}
          >
            저장된 커리어 계속
          </button>
        </>
      }
    >
      <div className="start-grid" aria-label="게임 상태">
        <div>
          <strong>현재 단계</strong>
          <span>선수 등록</span>
        </div>
        <div>
          <strong>진행 방식</strong>
          <span>주간 선택</span>
        </div>
        <div>
          <strong>저장 방식</strong>
          <span>브라우저 저장</span>
        </div>
      </div>
    </ScreenShell>
  );
}
