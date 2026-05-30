import { type FormEvent, useState } from "react";
import {
  createPlayerProfile,
  POSITION_LABELS,
  type PlayerPosition,
  type PlayerProfile,
} from "../domain/player";
import { STARTER_CLUBS } from "../data/clubs";
import { ScreenShell } from "../components/ScreenShell";

interface PlayerCreationScreenProps {
  onBack: () => void;
  onCreatePlayer: (player: PlayerProfile) => void;
}

const POSITIONS = Object.keys(POSITION_LABELS) as PlayerPosition[];

export function PlayerCreationScreen({
  onBack,
  onCreatePlayer,
}: PlayerCreationScreenProps) {
  const [name, setName] = useState("");
  const [position, setPosition] = useState<PlayerPosition>("striker");
  const [clubId, setClubId] = useState(STARTER_CLUBS[0].id);

  const submitPlayer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onCreatePlayer(createPlayerProfile(name, position, clubId));
  };

  return (
    <ScreenShell eyebrow="선수 생성" title="나의 선수">
      <form className="creation-form" onSubmit={submitPlayer}>
        <label>
          선수 이름
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="예: 강민재"
            maxLength={20}
          />
        </label>

        <label>
          포지션
          <select
            value={position}
            onChange={(event) => setPosition(event.target.value as PlayerPosition)}
          >
            {POSITIONS.map((positionId) => (
              <option key={positionId} value={positionId}>
                {POSITION_LABELS[positionId]}
              </option>
            ))}
          </select>
        </label>

        <label>
          시작 클럽
          <select value={clubId} onChange={(event) => setClubId(event.target.value)}>
            {STARTER_CLUBS.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </label>

        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={onBack}>
            돌아가기
          </button>
          <button className="primary-button" type="submit">
            커리어 시작
          </button>
        </div>
      </form>
    </ScreenShell>
  );
}
