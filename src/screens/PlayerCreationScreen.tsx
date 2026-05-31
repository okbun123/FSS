import { type FormEvent, useMemo, useState } from "react";
import { AttributeTable } from "../components/career/AttributeTable";
import { MetricGrid } from "../components/career/MetricGrid";
import { ScreenShell } from "../components/ScreenShell";
import { STARTER_CLUBS, getLeagueName } from "../data/fictionalLeagues";
import {
  getDominantFootLabel,
  getPotentialHint,
  PERSONALITY_LABELS,
  POSITION_LABELS,
  validatePlayerCreationInput,
  type PlayerCreationInput,
} from "../domain/player";
import type { CareerState, Position } from "../domain/types";
import { createNewCareer } from "../game/monthlyCareer";
import { generatePlayerRoll } from "../game/playerGeneration";

interface PlayerCreationScreenProps {
  onBack: () => void;
  onCreateCareer: (career: CareerState) => void;
}

const STARTER_CLUB_IDS = STARTER_CLUBS.map((club) => club.id);
const DEFAULT_STARTER_CLUB = STARTER_CLUBS[0];

const INITIAL_INPUT: PlayerCreationInput = {
  name: "",
  nationality: "대한민국",
  clubId: DEFAULT_STARTER_CLUB?.id ?? "",
};

function createRollSeed(): string {
  return `roll-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function PlayerCreationScreen({ onBack, onCreateCareer }: PlayerCreationScreenProps) {
  const [input, setInput] = useState<PlayerCreationInput>(INITIAL_INPUT);
  const [rollSeed, setRollSeed] = useState(createRollSeed);
  const [errors, setErrors] = useState<string[]>([]);
  const roll = useMemo(() => generatePlayerRoll(rollSeed), [rollSeed]);
  const [selectedPosition, setSelectedPosition] = useState<Position>(roll.recommendations[0].position);
  const selectedRecommendation =
    roll.recommendations.find((recommendation) => recommendation.position === selectedPosition) ??
    roll.recommendations[0];

  const updateInput = <Key extends keyof PlayerCreationInput>(
    key: Key,
    value: PlayerCreationInput[Key],
  ) => {
    setInput((currentInput) => ({ ...currentInput, [key]: value }));
  };

  const reroll = () => {
    const nextSeed = createRollSeed();
    const nextRoll = generatePlayerRoll(nextSeed);

    setRollSeed(nextSeed);
    setSelectedPosition(nextRoll.recommendations[0].position);
    setErrors([]);
  };

  const submitPlayer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors = validatePlayerCreationInput(input, STARTER_CLUB_IDS);
    setErrors(validationErrors);

    if (validationErrors.length === 0) {
      onCreateCareer(
        createNewCareer({
          ...input,
          clubId: DEFAULT_STARTER_CLUB.id,
          position: selectedRecommendation.position,
          roll,
        }),
      );
    }
  };

  return (
    <ScreenShell
      eyebrow="선수 생성"
      title="랜덤 유망주 뽑기"
      actions={
        <>
          <button className="secondary-button" type="button" onClick={onBack}>
            돌아가기
          </button>
          <button className="secondary-button" type="button" onClick={reroll}>
            다시 뽑기
          </button>
        </>
      }
      wide
    >
      <form className="creation-layout" onSubmit={submitPlayer} noValidate>
        <section className="creation-form data-panel">
          <h2>기본 정보</h2>
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
                placeholder="예: 강하준"
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
          </div>

          <div className="form-actions">
            <button className="primary-button" type="submit">
              이 선수로 시작
            </button>
          </div>
        </section>

        <section className="roll-summary">
          <div className="data-panel">
            <h2>생성 결과</h2>
            <MetricGrid
              items={[
                { label: "나이", value: `${roll.age}세` },
                { label: "선택 포지션", value: POSITION_LABELS[selectedRecommendation.position] },
                { label: "OVR", value: selectedRecommendation.overall, tone: selectedRecommendation.overall >= 68 ? "good" : "default" },
                { label: "잠재력", value: getPotentialHint(roll.potential), tone: roll.potential >= 88 ? "good" : "default" },
                { label: "성격", value: PERSONALITY_LABELS[roll.personality] },
                { label: "주발", value: getDominantFootLabel(roll) },
                { label: "왼발", value: roll.leftFoot },
                { label: "오른발", value: roll.rightFoot },
                { label: "성장 유형", value: roll.archetype },
              ]}
            />
          </div>

          <section className="data-panel">
            <h2>포지션 추천</h2>
            <div className="recommendation-list">
              {roll.recommendations.map((recommendation) => (
                <button
                  className={recommendation.position === selectedRecommendation.position ? "recommendation selected" : "recommendation"}
                  key={recommendation.position}
                  type="button"
                  onClick={() => setSelectedPosition(recommendation.position)}
                >
                  <strong>
                    {POSITION_LABELS[recommendation.position]} · OVR {recommendation.overall} · 적합도 {recommendation.fitScore}
                  </strong>
                  <span>{recommendation.reason}</span>
                  <small>
                    강점: {recommendation.keyStrengths.join(", ") || "뚜렷한 강점 없음"} · 보완: {recommendation.keyWeaknesses.join(", ") || "큰 약점 없음"}
                  </small>
                </button>
              ))}
            </div>
          </section>

          <section className="data-panel">
            <h2>초기 배정</h2>
            <MetricGrid
              items={[
                { label: "클럽", value: DEFAULT_STARTER_CLUB.name },
                { label: "리그", value: getLeagueName(DEFAULT_STARTER_CLUB.leagueId) },
                { label: "유스 시설", value: DEFAULT_STARTER_CLUB.trainingFacilities.youthDevelopment },
              ]}
            />
          </section>
        </section>
      </form>

      <AttributeTable
        attributes={roll.attributes}
        leftFoot={roll.leftFoot}
        rightFoot={roll.rightFoot}
        selectedPosition={selectedRecommendation.position}
      />
    </ScreenShell>
  );
}
