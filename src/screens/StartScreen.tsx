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
      eyebrow="주간 커리어 시뮬레이션"
      title="풋볼 커리어"
      subtitle={
        <p className="screen-lede">
          낮은 리그에서 출발해 몸상태, 입지, 이적 제안을 관리하며 시즌을 쌓아가는 커리어 시뮬레이션
        </p>
      }
      variant="start"
      actions={
        <>
          <button className="primary-button" type="button" onClick={onContinueCareer} disabled={!hasSavedCareer}>
            이어하기
          </button>
          <button className="secondary-button" type="button" onClick={onStartNewCareer}>
            새 커리어
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

      <dl className="start-grid" aria-label="게임 상태">
        <div>
          <dt>저장 상태</dt>
          <dd>{hasSavedCareer ? "저장 있음" : "저장 없음"}</dd>
        </div>
        <div>
          <dt>최근 저장</dt>
          <dd>{savedAtLabel ?? "기록 없음"}</dd>
        </div>
        <div>
          <dt>진행 방식</dt>
          <dd>주간 진행</dd>
        </div>
      </dl>
    </ScreenShell>
  );
}
