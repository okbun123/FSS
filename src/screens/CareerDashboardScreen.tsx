import { POSITION_LABELS, type PlayerProfile } from "../domain/player";
import { getClubName } from "../data/clubs";
import { ScreenShell } from "../components/ScreenShell";

interface CareerDashboardScreenProps {
  player: PlayerProfile;
  onResetCareer: () => void;
}

export function CareerDashboardScreen({
  player,
  onResetCareer,
}: CareerDashboardScreenProps) {
  return (
    <ScreenShell
      eyebrow="커리어 대시보드"
      title={`${player.name} 선수`}
      actions={
        <button className="danger-button" type="button" onClick={onResetCareer}>
          커리어 초기화
        </button>
      }
    >
      <div className="dashboard-grid">
        <article>
          <span>나이</span>
          <strong>{player.age}세</strong>
        </article>
        <article>
          <span>포지션</span>
          <strong>{POSITION_LABELS[player.position]}</strong>
        </article>
        <article>
          <span>소속 클럽</span>
          <strong>{getClubName(player.clubId)}</strong>
        </article>
        <article>
          <span>현재 주차</span>
          <strong>1주차</strong>
        </article>
      </div>
    </ScreenShell>
  );
}
