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
const ALL_LEAGUES = Object.values(FICTIONAL_LEAGUES);
const DEFAULT_LEAGUE = DEFAULT_CLUB ? FICTIONAL_LEAGUES[DEFAULT_CLUB.leagueId] : ALL_LEAGUES[0];
const ALL_COUNTRIES = [...new Set(ALL_LEAGUES.map((league) => league.country))];
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

  return getPositionFitBandLabel(band);
}

export function getPositionFitBandLabel(band: PositionFitBand): string {

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

export function getRelativePositionFitBand(
  recommendation: Pick<PositionRecommendation, "fitScore">,
  recommendations: Array<Pick<PositionRecommendation, "fitScore">>,
): PositionFitBand {
  const scores = recommendations.map((item) => item.fitScore);
  const bestScore = Math.max(...scores, recommendation.fitScore);
  const worstScore = Math.min(...scores, recommendation.fitScore);
  const scoreRange = Math.max(1, bestScore - worstScore);
  const relativeScore = ((recommendation.fitScore - worstScore) / scoreRange) * 100;

  if (recommendation.fitScore >= bestScore - 2) {
    return "fit-excellent";
  }
  if (relativeScore >= 72) {
    return "fit-good";
  }
  if (relativeScore >= 46) {
    return "fit-average";
  }
  if (relativeScore >= 22) {
    return "fit-weak";
  }
  return "fit-poor";
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
  countryFilter?: string | "all";
  leagueFilter: LeagueTier | "all";
  roleFilter?: TeamFitRole | "all";
  reputationFilter?: number | "all";
  trainingFilter?: number | "all";
}

export interface CreationTeamRow {
  club: Club;
  fit: TeamFitResult;
  country: string;
  leagueName: string;
}

export interface CreationTeamDisplayRow {
  teamName: string;
  country: string;
  leagueName: string;
  squadStrengthStars: string;
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
    country: row.country,
    leagueName: row.leagueName,
    squadStrengthStars: formatStars(row.fit.squadStrengthStars),
    youthOpportunityStars: formatStars(row.fit.youthOpportunityStars),
    publicInfoText: [
      `전력 ${formatStars(row.fit.squadStrengthStars)}`,
      `유스 ${formatStars(row.fit.youthOpportunityStars)}`,
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
        country: league.country,
        leagueName: getLeagueName(club.leagueId),
      };
    })
    .filter((row): row is CreationTeamRow => Boolean(row))
    .filter(({ club, country, fit }) => {
      return (
        (!filters.countryFilter || filters.countryFilter === "all" || country === filters.countryFilter) &&
        (filters.leagueFilter === "all" || club.leagueId === filters.leagueFilter) &&
        (!filters.roleFilter || filters.roleFilter === "all" || fit.role === filters.roleFilter) &&
        (!filters.reputationFilter ||
          filters.reputationFilter === "all" ||
          fit.reputationStars === filters.reputationFilter) &&
        (!filters.trainingFilter ||
          filters.trainingFilter === "all" ||
          fit.trainingFacilityStars === filters.trainingFilter)
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
    { label: "주발", value: getDominantFootLabel(roll.leftFoot, roll.rightFoot) },
    { label: "잠재력", value: getPotentialHint(roll.potential) },
    { label: "유형", value: roll.archetype },
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
  const detailGroups: Array<{ id: string; label: string; values: Array<[string, number]> }> = [
    {
      id: "foot",
      label: "발",
      values: [
        ["leftFoot", roll.leftFoot],
        ["rightFoot", roll.rightFoot],
      ],
    },
    ...(Object.entries(attributes) as Array<[keyof Attributes, Record<string, number>]>).map(([group, values]) => ({
      id: group,
      label: ATTRIBUTE_GROUP_LABELS_KO[group],
      values: Object.entries(values),
    })),
  ];

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
        {detailGroups.map((group) => (
          <section key={group.id}>
            <h3>{group.label}</h3>
            <dl>
              {group.values.map(([key, value]) => (
                <div key={`${group.id}-${key}`}>
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
  const [countryFilter, setCountryFilter] = useState<string>(DEFAULT_LEAGUE?.country ?? ALL_COUNTRIES[0] ?? "대한민국");
  const [leagueFilter, setLeagueFilter] = useState<LeagueTier>(DEFAULT_CLUB?.leagueId ?? "div1");
  const [teamPage, setTeamPage] = useState(0);
  const roll = useMemo(() => generatePlayerRoll(rollSeed), [rollSeed]);
  const [selectedPosition, setSelectedPosition] = useState<Position>(roll.recommendations[0].position);
  const selectedRecommendation =
    roll.recommendations.find((recommendation) => recommendation.position === selectedPosition) ??
    roll.recommendations[0];
  const selectedClub = ALL_CLUBS.find((club) => club.id === input.clubId) ?? DEFAULT_CLUB;
  const currentStep = CREATION_STEPS[stepIndex];
  const positionOptions = useMemo(() => getCreationPositionOptions(roll), [roll]);
  const countryLeagues = useMemo(
    () => ALL_LEAGUES.filter((league) => league.country === countryFilter),
    [countryFilter],
  );

  const teamRows = useMemo(() => {
    return getCreationTeamRows({
      clubs: ALL_CLUBS,
      leagues: FICTIONAL_LEAGUES,
      playerOverall: selectedRecommendation.overall,
      selectedPosition,
      filters: {
        countryFilter,
        leagueFilter,
      },
    });
  }, [countryFilter, leagueFilter, selectedPosition, selectedRecommendation.overall]);

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

  const selectFirstClubInLeague = (leagueId: LeagueTier) => {
    const firstClub = ALL_CLUBS.find((club) => club.leagueId === leagueId);

    if (firstClub) {
      updateInput("clubId", firstClub.id);
    }
  };

  const changeCountry = (country: string) => {
    const firstLeague = ALL_LEAGUES.find((league) => league.country === country);

    setCountryFilter(country);
    setLeagueFilter(firstLeague?.id ?? leagueFilter);
    setTeamPage(0);

    if (firstLeague) {
      selectFirstClubInLeague(firstLeague.id);
    }
  };

  const changeLeague = (leagueId: LeagueTier) => {
    setLeagueFilter(leagueId);
    setTeamPage(0);
    selectFirstClubInLeague(leagueId);
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
            <div className="roll-summary" aria-hidden="true" />
          ) : null}

          {currentStep.id === "position" ? (
            <div className="recommendation-list position-grid">
              {positionOptions.map((recommendation) => {
                const isSelected = selectedPosition === recommendation.position;
                const riskNote = getPoorFitRiskNote(recommendation);
                const relativeFitBand = getRelativePositionFitBand(recommendation, positionOptions);

                return (
                  <button
                    className={[
                      "recommendation",
                      "position-card",
                      relativeFitBand,
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
                      {getPositionFitBandLabel(relativeFitBand)} · 적합도 {recommendation.fitScore} · OVR {recommendation.overall}
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
                  국가 선택
                  <select
                    value={countryFilter}
                    onChange={(event) => {
                      changeCountry(event.target.value);
                    }}
                  >
                    {ALL_COUNTRIES.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  리그 선택
                  <select
                    value={leagueFilter}
                    onChange={(event) => {
                      changeLeague(event.target.value as LeagueTier);
                    }}
                  >
                    {countryLeagues.map((league) => (
                      <option key={league.id} value={league.id}>
                        {league.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="team-card-grid team-table-scroll">
                {visibleTeamRows.map((row) => {
                  const { club } = row;
                  const displayRow = getCreationTeamDisplayRow(row);
                  const isSelected = club.id === input.clubId;

                  return (
                    <button
                      className={[
                        "team-selection-card",
                        displayRow.fitColorClass,
                        isSelected ? "selected" : "",
                      ].filter(Boolean).join(" ")}
                      key={club.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        if (canSelectCreationTeam(club.id)) {
                          updateInput("clubId", club.id);
                        }
                      }}
                    >
                      <header>
                        <strong>{displayRow.teamName}</strong>
                        <span>{displayRow.fitLabel} · {displayRow.fitScore}</span>
                      </header>
                      <dl>
                        <div>
                          <dt>국가</dt>
                          <dd>{displayRow.country}</dd>
                        </div>
                        <div>
                          <dt>리그</dt>
                          <dd>{displayRow.leagueName}</dd>
                        </div>
                        <div>
                          <dt>전력</dt>
                          <dd>{displayRow.squadStrengthStars}</dd>
                        </div>
                        <div>
                          <dt>유스</dt>
                          <dd>{displayRow.youthOpportunityStars}</dd>
                        </div>
                        <div>
                          <dt>예상 역할</dt>
                          <dd>{displayRow.roleLabel}</dd>
                        </div>
                        <div>
                          <dt>적합도</dt>
                          <dd>{displayRow.fitLabel}</dd>
                        </div>
                      </dl>
                    </button>
                  );
                })}
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
        </div>

        <AttributeSummary
          roll={roll}
          attributes={roll.attributes}
          selectedPosition={selectedRecommendation.position}
        />

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
