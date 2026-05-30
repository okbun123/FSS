import { getClubName } from "../data/clubs";
import {
  FOOT_LABELS,
  PERSONALITY_LABELS,
  PLAY_STYLE_LABELS,
  POSITION_LABELS,
} from "../domain/player";
import type { CareerState } from "../domain/types";
import { ScreenShell } from "../components/ScreenShell";

interface CareerDashboardScreenProps {
  career: CareerState;
  onResetCareer: () => void;
}

export function CareerDashboardScreen({
  career,
  onResetCareer,
}: CareerDashboardScreenProps) {
  const { player } = career;

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
          <span>국적 / 나이</span>
          <strong>
            {player.nationality}, {player.age}세
          </strong>
        </article>
        <article>
          <span>포지션</span>
          <strong>
            {player.position} - {POSITION_LABELS[player.position]}
          </strong>
        </article>
        <article>
          <span>플레이 스타일</span>
          <strong>{PLAY_STYLE_LABELS[player.playStyle]}</strong>
        </article>
        <article>
          <span>주발</span>
          <strong>{FOOT_LABELS[player.preferredFoot]}</strong>
        </article>
        <article>
          <span>성격</span>
          <strong>{PERSONALITY_LABELS[player.personality]}</strong>
        </article>
        <article>
          <span>소속 클럽</span>
          <strong>{getClubName(player.clubId)}</strong>
        </article>
        <article>
          <span>현재 주차</span>
          <strong>{career.currentWeek}주차</strong>
        </article>
        <article>
          <span>컨디션</span>
          <strong>{career.condition}</strong>
        </article>
      </div>
    </ScreenShell>
  );
}
