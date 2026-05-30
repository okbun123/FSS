import { type FormEvent, useMemo, useState } from "react";
import { STARTER_CLUBS } from "../data/clubs";
import { ScreenShell } from "../components/ScreenShell";
import {
  FOOT_LABELS,
  generateStartingAttributes,
  getPlayStylesForPosition,
  PERSONALITY_LABELS,
  PLAY_STYLE_LABELS,
  POSITION_LABELS,
  validatePlayerCreationInput,
  type Personality,
  type PlayerCreationInput,
  type PlayerPosition,
  type PreferredFoot,
} from "../domain/player";
import type { Attributes, CareerState } from "../domain/types";
import { createNewCareer } from "../game/career";

interface PlayerCreationScreenProps {
  onBack: () => void;
  onCreateCareer: (career: CareerState) => void;
}

const POSITIONS = Object.keys(POSITION_LABELS) as PlayerPosition[];
const FOOT_OPTIONS = Object.keys(FOOT_LABELS) as PreferredFoot[];
const PERSONALITIES = Object.keys(PERSONALITY_LABELS) as Personality[];
const STARTER_CLUB_IDS = STARTER_CLUBS.map((club) => club.id);

const ATTRIBUTE_GROUPS: Array<{
  title: string;
  values: keyof Attributes;
  labels: Record<string, string>;
}> = [
  {
    title: "기술",
    values: "technical",
    labels: {
      finishing: "결정력",
      passing: "패스",
      dribbling: "드리블",
      defending: "수비",
      firstTouch: "퍼스트 터치",
    },
  },
  {
    title: "피지컬",
    values: "physical",
    labels: {
      pace: "스피드",
      stamina: "체력",
      strength: "힘",
      agility: "민첩성",
    },
  },
  {
    title: "멘탈",
    values: "mental",
    labels: {
      decisions: "판단력",
      composure: "침착성",
      workRate: "활동량",
      teamwork: "팀워크",
    },
  },
  {
    title: "커리어",
    values: "career",
    labels: {
      professionalism: "프로 의식",
      adaptability: "적응력",
      leadership: "리더십",
      marketability: "스타성",
    },
  },
];

const INITIAL_INPUT: PlayerCreationInput = {
  name: "",
  nationality: "대한민국",
  age: 18,
  preferredFoot: "right",
  position: "ST",
  playStyle: "poacher",
  personality: "diligent",
  clubId: STARTER_CLUBS[0]?.id ?? "",
};

function AttributePreview({ attributes }: { attributes: Attributes }) {
  return (
    <aside className="attribute-preview" aria-label="생성 능력치 미리보기">
      <div>
        <span className="eyebrow">능력치 미리보기</span>
        <h2>시작 능력치</h2>
      </div>
      <div className="attribute-groups">
        {ATTRIBUTE_GROUPS.map((group) => (
          <section className="attribute-group" key={group.values}>
            <h3>{group.title}</h3>
            <dl>
              {Object.entries(attributes[group.values]).map(([key, value]) => (
                <div key={key}>
                  <dt>{group.labels[key]}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </aside>
  );
}

export function PlayerCreationScreen({
  onBack,
  onCreateCareer,
}: PlayerCreationScreenProps) {
  const [input, setInput] = useState<PlayerCreationInput>(INITIAL_INPUT);
  const [errors, setErrors] = useState<string[]>([]);
  const playStyleOptions = getPlayStylesForPosition(input.position);
  const previewAttributes = useMemo(
    () => generateStartingAttributes(input),
    [input.age, input.position, input.playStyle, input.personality],
  );

  const updateInput = <Key extends keyof PlayerCreationInput>(
    key: Key,
    value: PlayerCreationInput[Key],
  ) => {
    setInput((currentInput) => ({ ...currentInput, [key]: value }));
  };

  const updatePosition = (position: PlayerPosition) => {
    setInput((currentInput) => ({
      ...currentInput,
      position,
      playStyle: getPlayStylesForPosition(position)[0].id,
    }));
  };

  const submitPlayer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors = validatePlayerCreationInput(input, STARTER_CLUB_IDS);
    setErrors(validationErrors);

    if (validationErrors.length === 0) {
      onCreateCareer(createNewCareer(input));
    }
  };

  return (
    <ScreenShell eyebrow="선수 생성" title="나의 첫 프로필">
      <div className="creation-layout">
        <form className="creation-form" onSubmit={submitPlayer} noValidate>
          {errors.length > 0 ? (
            <div className="error-list" role="alert">
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          <div className="form-grid">
            <label>
              선수 이름
              <input
                type="text"
                value={input.name}
                onChange={(event) => updateInput("name", event.target.value)}
                placeholder="예: 강민재"
                maxLength={20}
                required
              />
            </label>

            <label>
              국적
              <input
                type="text"
                value={input.nationality}
                onChange={(event) => updateInput("nationality", event.target.value)}
                placeholder="예: 대한민국"
                maxLength={20}
                required
              />
            </label>

            <label>
              나이
              <select
                value={input.age}
                onChange={(event) => updateInput("age", Number(event.target.value))}
              >
                {[16, 17, 18, 19].map((age) => (
                  <option key={age} value={age}>
                    {age}세
                  </option>
                ))}
              </select>
            </label>

            <label>
              주발
              <select
                value={input.preferredFoot}
                onChange={(event) =>
                  updateInput("preferredFoot", event.target.value as PreferredFoot)
                }
              >
                {FOOT_OPTIONS.map((foot) => (
                  <option key={foot} value={foot}>
                    {FOOT_LABELS[foot]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              주 포지션
              <select
                value={input.position}
                onChange={(event) => updatePosition(event.target.value as PlayerPosition)}
              >
                {POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {position} - {POSITION_LABELS[position]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              플레이 스타일
              <select
                value={input.playStyle}
                onChange={(event) =>
                  updateInput("playStyle", event.target.value as PlayerCreationInput["playStyle"])
                }
              >
                {playStyleOptions.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              성격
              <select
                value={input.personality}
                onChange={(event) =>
                  updateInput("personality", event.target.value as Personality)
                }
              >
                {PERSONALITIES.map((personality) => (
                  <option key={personality} value={personality}>
                    {PERSONALITY_LABELS[personality]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              시작 클럽
              <select value={input.clubId} onChange={(event) => updateInput("clubId", event.target.value)}>
                {STARTER_CLUBS.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name} - 평판 {club.reputation}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={onBack}>
              돌아가기
            </button>
            <button className="primary-button" type="submit">
              이 선수로 시작
            </button>
          </div>
        </form>

        <AttributePreview attributes={previewAttributes} />
      </div>
      <p className="creation-note">
        시작 능력치는 포지션, 플레이 스타일, 나이, 성격에 따라 결정됩니다.
      </p>
    </ScreenShell>
  );
}
