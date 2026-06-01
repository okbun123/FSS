import { type FormEvent, useMemo, useState } from "react";
import { MetricGrid } from "../components/career/MetricGrid";
import { ScreenShell } from "../components/ScreenShell";
import { FICTIONAL_LEAGUES, getAllClubs, getLeagueName } from "../data/fictionalLeagues";
import { deriveDominantFoot, type PlayerCreationInput } from "../domain/player";
import { formatStars } from "../domain/clubPublicInfo";
import {
  TEAM_FIT_ROLE_LABELS,
  calculateTeamFit,
  type TeamFitBand,
  type TeamFitResult,
  type TeamFitRole,
} from "../domain/teamFit";
import type { Attributes, CareerState, Club, League, LeagueTier, Position, PositionRecommendation } from "../domain/types";
import { createNewCareer } from "../game/monthlyCareer";
import { generatePlayerRoll, type PlayerRoll } from "../game/playerGeneration";

interface PlayerCreationScreenProps {
  onBack: () => void;
  onCreateCareer: (career: CareerState) => void;
}

export type CreationStep = "identity" | "position" | "team" | "confirm";

export const CREATION_STEPS: Array<{ id: CreationStep; label: string }> = [
  { id: "identity", label: "선수 생성 / 능력치 뽑기" },
  { id: "position", label: "포지션 선택" },
  { id: "team", label: "팀 선택" },
  { id: "confirm", label: "확인" },
];

const POSITION_ORDER: Position[] = ["ST", "LW", "RW", "AM", "CM", "DM", "FB", "CB"];
const POSITION_LABELS_KO: Record<Position, string> = {
  ST: "스트라이커",
  LW: "왼쪽 윙어",
  RW: "오른쪽 윙어",
  AM: "공격형 미드필더",
  CM: "중앙 미드필더",
  DM: "수비형 미드필더",
  FB: "풀백",
  CB: "센터백",
};

const ATTRIBUTE_GROUP_LABELS_KO: Record<keyof Attributes, string> = {
  technical: "기술",
  physical: "피지컬",
  mental: "멘탈",
  career: "커리어",
};

const ATTRIBUTE_LABELS_KO: Record<string, string> = {
  finishing: "결정력",
  shooting: "슛",
  passing: "패스",
  dribbling: "드리블",
  defending: "수비",
  firstTouch: "퍼스트 터치",
  crossing: "크로스",
  tackling: "태클",
  marking: "마킹",
  heading: "헤더",
  pace: "페이스",
  speed: "속도",
  acceleration: "가속",
  stamina: "체력",
  strength: "힘",
  agility: "민첩성",
  decisions: "판단",
  composure: "침착성",
  concentration: "집중력",
  workRate: "활동량",
  teamwork: "팀워크",
  professionalism: "프로 의식",
  adaptability: "적응력",
  leadership: "리더십",
  marketability: "스타성",
};

const DEFAULT_CLUB = getAllClubs()[0];
const ALL_CLUBS = getAllClubs();
const ALL_CLUB_IDS = ALL_CLUBS.map((club) => club.id);
export const CREATION_TEAM_PAGE_SIZE = 8;

const INITIAL_INPUT: PlayerCreationInput = {
  name: "",
  nationality: "대한민국",
  clubId: DEFAULT_CLUB?.id ?? "",
};

function createRollSeed(): string {
  return `roll-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getPotentialHint(potential: number): string {
  if (potential >= 92) {
    return "리그를 바꿀 수 있는 재능";
  }
  if (potential >= 87) {
    return "상위권 주전급 잠재력";
  }
  if (potential >= 82) {
    return "꾸준히 키우면 주전급";
  }
  return "성장 환경이 중요한 유망주";
}

function getDominantFootLabel(leftFoot: number, rightFoot: number): string {
  const dominantFoot = deriveDominantFoot(leftFoot, rightFoot);
  return dominantFoot === "both" ? "양발" : dominantFoot === "left" ? "왼발" : "오른발";
}

export type PositionFitBand = "fit-poor" | "fit-weak" | "fit-average" | "fit-good" | "fit-excellent";

export function getPositionFitBand(fitScore: number): PositionFitBand {
  const normalizedFitScore = Math.max(0, Math.min(100, fitScore));

  if (normalizedFitScore >= 85) {
    return "fit-excellent";
  }
  if (normalizedFitScore >= 70) {
    return "fit-good";
  }
  if (normalizedFitScore >= 55) {
    return "fit-average";
  }
  if (normalizedFitScore >= 40) {
    return "fit-weak";
  }
  return "fit-poor";
}

export function getPositionFitLabel(fitScore: number): string {
  const band = getPositionFitBand(fitScore);

  if (band === "fit-excellent") {
    return "최상";
  }
  if (band === "fit-good") {
    return "좋음";
  }
  if (band === "fit-average") {
    return "보통";
  }
  if (band === "fit-weak") {
    return "약함";
  }
  return "위험";
}

export function getPoorFitRiskNote(recommendation: Pick<PositionRecommendation, "fitScore" | "keyWeaknesses">): string | null {
  if (getPositionFitBand(recommendation.fitScore) !== "fit-poor") {
    return null;
  }

  return `${recommendation.keyWeaknesses[0] ?? "핵심 능력"} 부족으로 초반 출전 경쟁 리스크가 큽니다.`;
}

export function getCreationPositionOptions(roll: PlayerRoll): PositionRecommendation[] {
  const orderByPosition = new Map(POSITION_ORDER.map((position, index) => [position, index]));

  return [...roll.recommendations].sort(
    (left, right) =>
      right.fitScore - left.fitScore ||
      (orderByPosition.get(left.position) ?? 99) - (orderByPosition.get(right.position) ?? 99),
  );
}

export function canSelectCreationPosition(recommendation: Pick<PositionRecommendation, "position">): boolean {
  return POSITION_ORDER.includes(recommendation.position);
}

export interface CreationTeamFilters {
  leagueFilter: LeagueTier | "all";
  roleFilter: TeamFitRole | "all";
  reputationFilter: number | "all";
  trainingFilter: number | "all";
}

export interface CreationTeamRow {
  club: Club;
  fit: TeamFitResult;
  leagueName: string;
}

export interface CreationTeamDisplayRow {
  teamName: string;
  leagueName: string;
  reputationStars: string;
  squadStrengthStars: string;
  budgetStars: string;
  trainingStars: string;
  youthOpportunityStars: string;
  publicInfoText: string;
  roleLabel: string;
  fitLabel: string;
  fitScore: number;
  fitColorClass: string;
}

export function getTeamFitColorClass(fit: Pick<TeamFitResult, "band">): string {
  return `fit-${fit.band}`;
}

export function getTeamFitLabel(band: TeamFitBand): string {
  if (band === "excellent") {
    return "최상";
  }
  if (band === "good") {
    return "좋음";
  }
  if (band === "average") {
    return "보통";
  }
  if (band === "weak") {
    return "약함";
  }
  return "위험";
}

export function canSelectCreationTeam(clubId: string, playableClubIds = ALL_CLUB_IDS): boolean {
  return playableClubIds.includes(clubId);
}

export function getCreationTeamDisplayRow(row: CreationTeamRow): CreationTeamDisplayRow {
  return {
    teamName: row.club.name,
    leagueName: row.leagueName,
    reputationStars: formatStars(row.fit.reputationStars),
    squadStrengthStars: formatStars(row.fit.squadStrengthStars),
    budgetStars: formatStars(row.fit.budgetStars),
    trainingStars: formatStars(row.fit.trainingFacilityStars),
    youthOpportunityStars: formatStars(row.fit.youthOpportunityStars),
    publicInfoText: [
      `평판 ${formatStars(row.fit.reputationStars)}`,
      `전력 ${formatStars(row.fit.squadStrengthStars)}`,
      `예산 ${formatStars(row.fit.budgetStars)}`,
      `유스 기회 ${formatStars(row.fit.youthOpportunityStars)}`,
      `훈련 시설 ${formatStars(row.fit.trainingFacilityStars)}`,
    ].join(" · "),
    roleLabel: TEAM_FIT_ROLE_LABELS[row.fit.role],
    fitLabel: getTeamFitLabel(row.fit.band),
    fitScore: row.fit.score,
    fitColorClass: getTeamFitColorClass(row.fit),
  };
}

export function getCreationTeamRows(input: {
  clubs: Club[];
  leagues: Partial<Record<LeagueTier, League>>;
  playerOverall: number;
  selectedPosition: Position;
  filters: CreationTeamFilters;
}): CreationTeamRow[] {
  const { clubs, leagues, playerOverall, selectedPosition, filters } = input;

  return clubs
    .map((club) => {
      const league = leagues[club.leagueId];

      if (!league) {
        return null;
      }

      const fit = calculateTeamFit({
        club,
        league,
        playerOverall,
        selectedPosition,
      });

      return {
        club,
        fit,
        leagueName: getLeagueName(club.leagueId),
      };
    })
    .filter((row): row is CreationTeamRow => Boolean(row))
    .filter(({ club, fit }) => {
      return (
        (filters.leagueFilter === "all" || club.leagueId === filters.leagueFilter) &&
        (filters.roleFilter === "all" || fit.role === filters.roleFilter) &&
        (filters.reputationFilter === "all" || fit.reputationStars === filters.reputationFilter) &&
        (filters.trainingFilter === "all" || fit.trainingFacilityStars === filters.trainingFilter)
      );
    })
    .sort(
      (left, right) =>
        right.fit.score - left.fit.score ||
        right.fit.youthOpportunityStars - left.fit.youthOpportunityStars ||
        right.fit.trainingFacilityStars - left.fit.trainingFacilityStars ||
        left.club.name.localeCompare(right.club.name),
    );
}

function validateCreationInput(input: PlayerCreationInput): string[] {
  const errors: string[] = [];

  if (input.name.trim().length < 2) {
    errors.push("선수 이름은 두 글자 이상 입력해 주세요.");
  }
  if (input.nationality.trim().length < 2) {
    errors.push("국적은 두 글자 이상 입력해 주세요.");
  }
  if (!ALL_CLUB_IDS.includes(input.clubId)) {
    errors.push("시작할 팀을 선택해 주세요.");
  }

  return errors;
}

export interface CreationStatPanelItem {
  label: string;
  value: number | string;
}

export function getCreationStatPanelItems(
  roll: PlayerRoll,
  selectedPosition: Position,
): CreationStatPanelItem[] {
  const recommendation =
    roll.recommendations.find((item) => item.position === selectedPosition) ?? roll.recommendations[0];

  return [
    { label: "나이", value: `${roll.age}세` },
    { label: "OVR", value: recommendation?.overall ?? "-" },
    { label: "왼발", value: roll.leftFoot },
    { label: "오른발", value: roll.rightFoot },
    { label: "주발", value: getDominantFootLabel(roll.leftFoot, roll.rightFoot) },
    { label: "잠재력", value: getPotentialHint(roll.potential) },
  ];
}

function AttributeSummary({
  roll,
  attributes,
  selectedPosition,
}: {
  roll: PlayerRoll;
  attributes: Attributes;
  selectedPosition: Position;
}) {
  const recommendation =
    roll.recommendations.find((item) => item.position === selectedPosition) ?? roll.recommendations[0];
  const statItems = getCreationStatPanelItems(roll, selectedPosition);

  return (
    <aside className="data-panel creation-stat-panel">
      <div>
        <h2>능력치 미리보기</h2>
        <p className="empty-note">
          {POSITION_LABELS_KO[selectedPosition]} OVR {recommendation?.overall ?? "-"} · {getPotentialHint(roll.potential)}
        </p>
      </div>
      <MetricGrid items={statItems} />
      <div className="attribute-compact-grid">
        {(Object.entries(attributes) as Array<[keyof Attributes, Record<string, number>]>).map(([group, values]) => (
          <section key={group}>
            <h3>{ATTRIBUTE_GROUP_LABELS_KO[group]}</h3>
            <dl>
              {Object.entries(values).map(([key, value]) => (
                <div key={`${group}-${key}`}>
                  <dt>{ATTRIBUTE_LABELS_KO[key] ?? key}</dt>
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

export function PlayerCreationScreen({ onBack, onCreateCareer }: PlayerCreationScreenProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [input, setInput] = useState<PlayerCreationInput>(INITIAL_INPUT);
  const [rollSeed, setRollSeed] = useState(createRollSeed);
  const [errors, setErrors] = useState<string[]>([]);
  const [leagueFilter, setLeagueFilter] = useState<LeagueTier | "all">("all");
  const [roleFilter, setRoleFilter] = useState<TeamFitRole | "all">("all");
  const [reputationFilter, setReputationFilter] = useState<number | "all">("all");
  const [trainingFilter, setTrainingFilter] = useState<number | "all">("all");
  const [teamPage, setTeamPage] = useState(0);
  const roll = useMemo(() => generatePlayerRoll(rollSeed), [rollSeed]);
  const [selectedPosition, setSelectedPosition] = useState<Position>(roll.recommendations[0].position);
  const selectedRecommendation =
    roll.recommendations.find((recommendation) => recommendation.position === selectedPosition) ??
    roll.recommendations[0];
  const selectedClub = ALL_CLUBS.find((club) => club.id === input.clubId) ?? DEFAULT_CLUB;
  const currentStep = CREATION_STEPS[stepIndex];
  const positionOptions = useMemo(() => getCreationPositionOptions(roll), [roll]);

  const teamRows = useMemo(() => {
    return getCreationTeamRows({
      clubs: ALL_CLUBS,
      leagues: FICTIONAL_LEAGUES,
      playerOverall: selectedRecommendation.overall,
      selectedPosition,
      filters: {
        leagueFilter,
        roleFilter,
        reputationFilter,
        trainingFilter,
      },
    });
  }, [leagueFilter, reputationFilter, roleFilter, selectedPosition, selectedRecommendation.overall, trainingFilter]);

  const teamPageCount = Math.max(1, Math.ceil(teamRows.length / CREATION_TEAM_PAGE_SIZE));
  const visibleTeamRows = teamRows.slice(
    teamPage * CREATION_TEAM_PAGE_SIZE,
    teamPage * CREATION_TEAM_PAGE_SIZE + CREATION_TEAM_PAGE_SIZE,
  );

  const updateInput = <Key extends keyof PlayerCreationInput>(
    key: Key,
    value: PlayerCreationInput[Key],
  ) => {
    setInput((currentInput) => ({ ...currentInput, [key]: value }));
    setErrors([]);
  };

  const reroll = () => {
    const nextSeed = createRollSeed();
    const nextRoll = generatePlayerRoll(nextSeed);

    setRollSeed(nextSeed);
    setSelectedPosition(nextRoll.recommendations[0].position);
    setErrors([]);
  };

  const goToStep = (nextStepIndex: number) => {
    if (nextStepIndex < 0 || nextStepIndex >= CREATION_STEPS.length) {
      return;
    }

    if (nextStepIndex > stepIndex && stepIndex === 0) {
      const validationErrors = validateCreationInput(input).filter((error) => !error.includes("팀"));
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }
    }

    setErrors([]);
    setStepIndex(nextStepIndex);
  };

  const submitPlayer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors = validateCreationInput(input);
    setErrors(validationErrors);

    if (validationErrors.length === 0) {
      onCreateCareer(
        createNewCareer({
          ...input,
          position: selectedRecommendation.position,
          roll,
        }),
      );
    }
  };

  return (
    <ScreenShell
      eyebrow="선수 생성"
      title="커리어 시작"
      actions={
        <button className="secondary-button" type="button" onClick={onBack}>
          돌아가기
        </button>
      }
      navigation={
        <nav className="creation-step-tabs" aria-label="선수 생성 단계">
          {CREATION_STEPS.map((step, index) => (
            <button
              className={index === stepIndex ? "tab-button active" : "tab-button"}
              key={step.id}
              type="button"
              onClick={() => goToStep(index)}
            >
              {index + 1}. {step.label}
            </button>
          ))}
        </nav>
      }
      wide
    >
      <form className="creation-step-layout" onSubmit={submitPlayer} noValidate>
        <div className="creation-left-rail">
          <section className="data-panel creation-identity-panel">
            <header className="panel-title-row">
              <h2>{currentStep.id === "identity" ? "선수 기본 정보" : "선수 요약"}</h2>
              <span>{currentStep.label}</span>
            </header>

            {currentStep.id === "identity" ? (
              <div className="creation-form">
                <div className="form-grid compact-form-grid">
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
              </div>
            ) : (
              <MetricGrid
                items={[
                  { label: "이름", value: input.name || "-" },
                  { label: "국적", value: input.nationality || "-" },
                  { label: "포지션", value: POSITION_LABELS_KO[selectedRecommendation.position] },
                  { label: "팀", value: selectedClub?.shortName ?? selectedClub?.name ?? "-" },
                ]}
              />
            )}
          </section>

          <AttributeSummary
            roll={roll}
            attributes={roll.attributes}
            selectedPosition={selectedRecommendation.position}
          />
        </div>

        <section className="data-panel creation-step-panel">
          <header className="panel-title-row">
            <h2>{currentStep.label}</h2>
            <span>
              {stepIndex + 1} / {CREATION_STEPS.length}
            </span>
          </header>

          <div className="creation-step-content">
          {errors.length > 0 ? (
            <div className="error-list" role="alert">
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          {currentStep.id === "identity" ? (
            <div className="roll-summary">
              <MetricGrid
                items={[
                  { label: "나이", value: `${roll.age}세` },
                  { label: "추천 OVR", value: selectedRecommendation.overall },
                  { label: "추천 포지션", value: POSITION_LABELS_KO[selectedRecommendation.position] },
                  { label: "주발", value: getDominantFootLabel(roll.leftFoot, roll.rightFoot) },
                  { label: "잠재력", value: getPotentialHint(roll.potential) },
                  { label: "유형", value: roll.archetype },
                ]}
              />
              <p className="empty-note">
                왼쪽 아래 능력치 패널에서 세부 능력치, 왼발, 오른발, 주발을 확인할 수 있습니다.
              </p>
            </div>
          ) : null}

          {currentStep.id === "position" ? (
            <div className="recommendation-list position-grid">
              {positionOptions.map((recommendation) => {
                const isSelected = selectedPosition === recommendation.position;
                const riskNote = getPoorFitRiskNote(recommendation);

                return (
                  <button
                    className={[
                      "recommendation",
                      "position-card",
                      getPositionFitBand(recommendation.fitScore),
                      isSelected ? "selected" : "",
                    ].filter(Boolean).join(" ")}
                    key={recommendation.position}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      if (canSelectCreationPosition(recommendation)) {
                        setSelectedPosition(recommendation.position);
                      }
                    }}
                  >
                    <strong>{POSITION_LABELS_KO[recommendation.position]} · {recommendation.position}</strong>
                    <span>
                      {getPositionFitLabel(recommendation.fitScore)} · 적합도 {recommendation.fitScore} · OVR {recommendation.overall}
                    </span>
                    <p>{recommendation.reason}</p>
                    <small>주요 매칭 {recommendation.keyStrengths.join(", ") || "-"} · 보완 {recommendation.keyWeaknesses.join(", ") || "-"}</small>
                    {riskNote ? <small className="recommendation-risk">{riskNote}</small> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {currentStep.id === "team" ? (
            <div className="team-selection-stack">
              <div className="team-filter-grid">
                <label>
                  리그
                  <select
                    value={leagueFilter}
                    onChange={(event) => {
                      setLeagueFilter(event.target.value as LeagueTier | "all");
                      setTeamPage(0);
                    }}
                  >
                    <option value="all">전체</option>
                    {Object.keys(FICTIONAL_LEAGUES).map((leagueId) => (
                      <option key={leagueId} value={leagueId}>
                        {getLeagueName(leagueId as LeagueTier)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  예상 역할
                  <select
                    value={roleFilter}
                    onChange={(event) => {
                      setRoleFilter(event.target.value as TeamFitRole | "all");
                      setTeamPage(0);
                    }}
                  >
                    <option value="all">전체</option>
                    <option value="bench">{TEAM_FIT_ROLE_LABELS.bench}</option>
                    <option value="rotation">{TEAM_FIT_ROLE_LABELS.rotation}</option>
                    <option value="starter">{TEAM_FIT_ROLE_LABELS.starter}</option>
                  </select>
                </label>
                <label>
                  평판
                  <select
                    value={reputationFilter}
                    onChange={(event) => {
                      setReputationFilter(event.target.value === "all" ? "all" : Number(event.target.value));
                      setTeamPage(0);
                    }}
                  >
                    <option value="all">전체</option>
                    {[1, 2, 3, 4, 5].map((stars) => (
                      <option key={stars} value={stars}>{stars}성</option>
                    ))}
                  </select>
                </label>
                <label>
                  훈련
                  <select
                    value={trainingFilter}
                    onChange={(event) => {
                      setTrainingFilter(event.target.value === "all" ? "all" : Number(event.target.value));
                      setTeamPage(0);
                    }}
                  >
                    <option value="all">전체</option>
                    {[1, 2, 3, 4, 5].map((stars) => (
                      <option key={stars} value={stars}>{stars}성</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="table-scroll team-table-scroll">
                <table className="compact-table">
                  <thead>
                    <tr>
                      <th scope="col">팀</th>
                      <th scope="col">리그</th>
                      <th scope="col">역할</th>
                      <th scope="col">적합</th>
                      <th scope="col">공개 정보</th>
                      <th scope="col">선택</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTeamRows.map((row) => {
                      const { club } = row;
                      const displayRow = getCreationTeamDisplayRow(row);

                      return (
                        <tr className={club.id === input.clubId ? "selected-row" : ""} key={club.id}>
                          <td>{displayRow.teamName}</td>
                          <td>{displayRow.leagueName}</td>
                          <td>{displayRow.roleLabel}</td>
                          <td className={displayRow.fitColorClass}>{displayRow.fitLabel} · {displayRow.fitScore}</td>
                          <td className="club-public-stars">{displayRow.publicInfoText}</td>
                          <td>
                            <button
                              className={club.id === input.clubId ? "primary-button table-action-button" : "secondary-button table-action-button"}
                              type="button"
                              aria-pressed={club.id === input.clubId}
                              onClick={() => {
                                if (canSelectCreationTeam(club.id)) {
                                  updateInput("clubId", club.id);
                                }
                              }}
                            >
                              선택
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pagination-row">
                <button className="secondary-button" type="button" onClick={() => setTeamPage((page) => Math.max(0, page - 1))} disabled={teamPage === 0}>
                  이전 페이지
                </button>
                <span>{teamPage + 1} / {teamPageCount}</span>
                <button className="secondary-button" type="button" onClick={() => setTeamPage((page) => Math.min(teamPageCount - 1, page + 1))} disabled={teamPage >= teamPageCount - 1}>
                  다음 페이지
                </button>
              </div>
            </div>
          ) : null}

          {currentStep.id === "confirm" ? (
            <div className="confirmation-grid">
              <MetricGrid
                items={[
                  { label: "이름", value: input.name || "-" },
                  { label: "국적", value: input.nationality || "-" },
                  { label: "포지션", value: POSITION_LABELS_KO[selectedRecommendation.position] },
                  { label: "OVR", value: selectedRecommendation.overall, tone: selectedRecommendation.overall >= 68 ? "good" : "default" },
                  { label: "팀", value: selectedClub?.name ?? "-" },
                  { label: "리그", value: selectedClub ? getLeagueName(selectedClub.leagueId) : "-" },
                ]}
              />
            </div>
          ) : null}
          </div>

        </section>

        <div className="form-actions creation-nav-actions">
          {stepIndex === 0 ? (
            <>
              <button className="secondary-button" type="button" onClick={reroll}>
                다시 뽑기
              </button>
              <button className="primary-button" type="button" onClick={() => goToStep(1)}>
                다음: 포지션 선택
              </button>
            </>
          ) : (
            <>
            <button className="secondary-button" type="button" onClick={() => goToStep(stepIndex - 1)} disabled={stepIndex === 0}>
              이전
            </button>
            {stepIndex < CREATION_STEPS.length - 1 ? (
              <button className="primary-button" type="button" onClick={() => goToStep(stepIndex + 1)}>
                {stepIndex === 1 ? "다음: 팀 선택" : "다음: 확인"}
              </button>
            ) : (
              <button className="primary-button" type="submit">
                이 선수로 시작
              </button>
            )}
            </>
          )}
          </div>
      </form>
    </ScreenShell>
  );
}
