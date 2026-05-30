import { useMemo, useState } from "react";
import { getClubName } from "../data/clubs";
import {
  FOOT_LABELS,
  PERSONALITY_LABELS,
  PLAY_STYLE_LABELS,
  POSITION_LABELS,
} from "../domain/player";
import type {
  AttributeFocus,
  AttributeGrowthEntry,
  CareerState,
  DevelopmentReport,
  KeyMoment,
  Match,
  PlayerMatchStats,
  RatingModifier,
  SeasonSummary,
  WeeklyActionType,
} from "../domain/types";
import { ScreenShell } from "../components/ScreenShell";
import { advanceWeek, getCurrentWeek } from "../game/career";
import {
  generateKeyMoments,
  simulateCurrentMatch,
} from "../game/matchSimulation";
import {
  createSeasonSummary,
  isSeasonComplete,
  startNextSeason,
} from "../game/season";
import {
  applyWeeklyAction,
  ATTRIBUTE_FOCUS_OPTIONS,
  canSimulateCurrentMatch,
} from "../game/weeklyActions";

interface CareerDashboardScreenProps {
  career: CareerState;
  savedAtLabel: string | null;
  saveError: string | null;
  saveMessage: string | null;
  onCareerChange: (career: CareerState) => void;
  onDeleteSave: () => void;
  onSaveCareer: () => void;
}

function getOpponentName(career: CareerState): string {
  const playerMatch = getCurrentWeek(career).playerMatch;

  if (!playerMatch) {
    return "이번 주 경기가 없습니다";
  }

  const opponentId =
    playerMatch.homeClubId === career.player.clubId
      ? playerMatch.awayClubId
      : playerMatch.homeClubId;

  return getClubName(opponentId);
}

function getMatchSeed(career: CareerState): string {
  return `${career.player.id}-${career.season.id}-${career.currentWeek}`;
}

function StatLine({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function PlayerStatsSummary({ stats }: { stats: PlayerMatchStats }) {
  return (
    <dl className="match-stats">
      <StatLine label="출전 시간" value={`${stats.minutesPlayed}분`} />
      <StatLine label="득점" value={stats.goals} />
      <StatLine label="도움" value={stats.assists} />
      <StatLine label="슈팅" value={stats.shots} />
      <StatLine label="키 패스" value={stats.keyPasses} />
      <StatLine label="태클" value={stats.tackles} />
      <StatLine label="턴오버" value={stats.turnovers} />
    </dl>
  );
}

function RatingModifiers({ modifiers }: { modifiers: RatingModifier[] }) {
  return (
    <dl className="rating-modifiers">
      {modifiers.map((modifier) => (
        <div className={`modifier-${modifier.kind}`} key={`${modifier.label}-${modifier.value}`}>
          <dt>{modifier.label}</dt>
          <dd>{modifier.value > 0 ? `+${modifier.value.toFixed(1)}` : modifier.value.toFixed(1)}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatGrowthAmount(amount: number): string {
  return `+${amount.toFixed(2)}`;
}

function formatSignedChange(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function aggregateGrowth(reports: DevelopmentReport[]): AttributeGrowthEntry[] {
  const totals = new Map<string, AttributeGrowthEntry>();

  for (const report of reports) {
    for (const entry of report.entries) {
      const existing = totals.get(entry.attribute);
      totals.set(entry.attribute, {
        ...entry,
        before: existing?.before ?? entry.before,
        after: entry.after,
        amount: (existing?.amount ?? 0) + entry.amount,
      });
    }
  }

  return [...totals.values()]
    .map((entry) => ({ ...entry, amount: Math.round(entry.amount * 100) / 100 }))
    .sort((left, right) => right.amount - left.amount);
}

function GrowthList({ entries }: { entries: AttributeGrowthEntry[] }) {
  if (entries.length === 0) {
    return <p className="empty-note">아직 기록된 성장이 없습니다.</p>;
  }

  return (
    <dl className="growth-list">
      {entries.map((entry) => (
        <div key={entry.attribute}>
          <dt>{entry.label}</dt>
          <dd>{formatGrowthAmount(entry.amount)}</dd>
        </div>
      ))}
    </dl>
  );
}

function DevelopmentReportPanel({ career }: { career: CareerState }) {
  const reports = career.developmentLog ?? [];
  const thisWeekEntries = aggregateGrowth(
    reports.filter((report) => report.week === career.currentWeek),
  );
  const recentReports = reports.filter(
    (report) => report.week >= Math.max(1, career.currentWeek - 4),
  );
  const recentEntries = aggregateGrowth(recentReports);
  const topEntries = recentEntries.slice(0, 3);

  return (
    <section className="development-panel" aria-labelledby="development-title">
      <div className="section-heading">
        <span className="eyebrow">개발 리포트</span>
        <h2 id="development-title">선수 성장</h2>
      </div>
      <div className="development-grid">
        <article>
          <h3>이번 주 성장</h3>
          <GrowthList entries={thisWeekEntries} />
        </article>
        <article>
          <h3>최근 5주 성장</h3>
          <GrowthList entries={recentEntries.slice(0, 5)} />
        </article>
        <article>
          <h3>주요 상승 능력</h3>
          <GrowthList entries={topEntries} />
        </article>
      </div>
    </section>
  );
}

function SeasonSummaryPanel({
  summary,
  onStartNextSeason,
}: {
  summary: SeasonSummary;
  onStartNextSeason: () => void;
}) {
  return (
    <section className="season-summary-panel" aria-labelledby="season-summary-title">
      <div className="section-heading">
        <span className="eyebrow">시즌 완료</span>
        <h2 id="season-summary-title">{summary.seasonNumber}시즌 요약</h2>
      </div>

      <div className="summary-grid">
        <div>
          <span>리그 순위</span>
          <strong>{summary.leaguePosition}위</strong>
        </div>
        <div>
          <span>출전</span>
          <strong>{summary.appearances}경기</strong>
        </div>
        <div>
          <span>득점</span>
          <strong>{summary.goals}</strong>
        </div>
        <div>
          <span>도움</span>
          <strong>{summary.assists}</strong>
        </div>
        <div>
          <span>평균 평점</span>
          <strong>{summary.averageRating.toFixed(2)}</strong>
        </div>
        <div>
          <span>감독 신뢰 변화</span>
          <strong>{formatSignedChange(summary.coachTrustChange)}</strong>
        </div>
        <div>
          <span>팬 지지 변화</span>
          <strong>{formatSignedChange(summary.fanSupportChange)}</strong>
        </div>
        <div>
          <span>평판 변화</span>
          <strong>{formatSignedChange(summary.reputationChange)}</strong>
        </div>
      </div>

      <div>
        <h3>능력치 성장 요약</h3>
        <GrowthList entries={summary.attributeGrowthSummary.slice(0, 6)} />
      </div>

      <div className="form-actions">
        <button className="primary-button" type="button" onClick={onStartNextSeason}>
          다음 시즌 시작
        </button>
      </div>
    </section>
  );
}

function CareerHistoryPanel({ career }: { career: CareerState }) {
  const history = career.careerHistory ?? [];

  if (history.length === 0) {
    return null;
  }

  return (
    <section className="career-history" aria-labelledby="career-history-title">
      <div className="section-heading">
        <span className="eyebrow">커리어 기록</span>
        <h2 id="career-history-title">시즌 히스토리</h2>
      </div>
      <ol className="history-list">
        {history.slice().reverse().map((entry) => (
          <li key={entry.id}>
            <span>
              {entry.seasonNumber}시즌 · {entry.clubName}
            </span>
            <strong>
              {entry.leaguePosition}위 / {entry.appearances}경기 / {entry.goals}골{" "}
              {entry.assists}도움 / 평점 {entry.averageRating.toFixed(2)}
            </strong>
          </li>
        ))}
      </ol>
    </section>
  );
}

function MatchResultPanel({ match }: { match: Match }) {
  const result = match.result;

  if (!result?.playerStats || !result.ratingModifiers || !result.keyMoments) {
    return null;
  }

  return (
    <section className="match-panel" aria-labelledby="match-result-title">
      <div className="section-heading">
        <span className="eyebrow">경기 결과</span>
        <h2 id="match-result-title">
          {getClubName(match.homeClubId)} {result.homeGoals}-{result.awayGoals}{" "}
          {getClubName(match.awayClubId)}
        </h2>
      </div>

      <div className="match-rating-card">
        <span>선수 평점</span>
        <strong>{result.playerRating?.toFixed(1)}</strong>
      </div>

      <PlayerStatsSummary stats={result.playerStats} />

      <div className="match-detail-grid">
        <section>
          <h3>평점 변화</h3>
          <RatingModifiers modifiers={result.ratingModifiers} />
        </section>

        <section>
          <h3>핵심 장면</h3>
          <ol className="moment-result-list">
            {result.keyMoments.map((moment) => {
              const selectedChoice = moment.choices.find(
                (choice) => choice.id === moment.selectedChoiceId,
              );

              return (
                <li key={moment.id}>
                  <span>{moment.minute}분</span>
                  <strong>{selectedChoice?.label}</strong>
                  <p>{moment.outcome?.description}</p>
                  <small>
                    성공 확률 {moment.outcome?.chance}% / 판정 {moment.outcome?.roll}
                  </small>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </section>
  );
}

export function CareerDashboardScreen({
  career,
  savedAtLabel,
  saveError,
  saveMessage,
  onCareerChange,
  onDeleteSave,
  onSaveCareer,
}: CareerDashboardScreenProps) {
  const { player } = career;
  const [selectedAction, setSelectedAction] = useState<WeeklyActionType>("teamTraining");
  const [selectedAttribute, setSelectedAttribute] =
    useState<AttributeFocus>("technical.finishing");
  const [actionError, setActionError] = useState<string | null>(null);
  const [matchMessage, setMatchMessage] = useState<string | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [pendingMoments, setPendingMoments] = useState<KeyMoment[] | null>(null);
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({});
  const [latestPlayedMatch, setLatestPlayedMatch] = useState<Match | null>(null);
  const currentWeek = useMemo(() => getCurrentWeek(career), [career]);
  const seasonComplete = useMemo(() => isSeasonComplete(career), [career]);
  const seasonSummary = useMemo(
    () => (seasonComplete ? createSeasonSummary(career) : null),
    [career, seasonComplete],
  );
  const opponentName = getOpponentName(career);
  const weeklyActionCompleted = Boolean(career.weeklyActionCompleted);
  const currentPlayerMatch = currentWeek.playerMatch;
  const canSimulateMatch = canSimulateCurrentMatch(career);
  const matchWithResult =
    latestPlayedMatch?.id === currentPlayerMatch?.id ? latestPlayedMatch : currentPlayerMatch;
  const hasPlayedCurrentMatch = currentPlayerMatch?.status === "played";
  const canAdvanceToNextWeek = Boolean(hasPlayedCurrentMatch && !seasonComplete);

  const completeWeeklyAction = () => {
    try {
      const updatedCareer = applyWeeklyAction(career, {
        actionType: selectedAction,
        attributeFocus:
          selectedAction === "individualTraining" ? selectedAttribute : undefined,
      });
      setActionError(null);
      setMatchError(null);
      setMatchMessage(null);
      setPendingMoments(null);
      setLatestPlayedMatch(null);
      onCareerChange(updatedCareer);
    } catch {
      setActionError("이번 주 행동을 적용하지 못했습니다. 선택 내용을 다시 확인해 주세요.");
    }
  };

  const prepareMatchSimulation = () => {
    if (!canSimulateMatch) {
      return;
    }

    const moments = generateKeyMoments(career, getMatchSeed(career));
    setPendingMoments(moments);
    setSelectedChoices(
      Object.fromEntries(moments.map((moment) => [moment.id, moment.choices[0].id])),
    );
    setMatchError(null);
    setMatchMessage("핵심 장면의 선택지를 고른 뒤 경기를 진행하세요.");
  };

  const updateMomentChoice = (momentId: string, choiceId: string) => {
    setSelectedChoices((currentChoices) => ({
      ...currentChoices,
      [momentId]: choiceId,
    }));
  };

  const simulateMatch = () => {
    if (!pendingMoments) {
      return;
    }

    try {
      const output = simulateCurrentMatch(career, {
        seed: getMatchSeed(career),
        moments: pendingMoments,
        choices: selectedChoices,
      });
      setLatestPlayedMatch(output.match);
      setPendingMoments(null);
      setMatchError(null);
      setMatchMessage("경기가 완료되었습니다. 결과를 확인하세요.");
      onCareerChange(output.careerState);
    } catch {
      setMatchError("경기 시뮬레이션을 진행하지 못했습니다. 현재 주차와 저장 상태를 확인해 주세요.");
    }
  };

  const moveToNextWeek = () => {
    const updatedCareer = advanceWeek(career);

    setActionError(null);
    setMatchError(null);
    setMatchMessage(`${updatedCareer.currentWeek}주차로 이동했습니다.`);
    setPendingMoments(null);
    setLatestPlayedMatch(null);
    onCareerChange(updatedCareer);
  };

  const beginNextSeason = () => {
    try {
      const updatedCareer = startNextSeason(career);

      setActionError(null);
      setMatchError(null);
      setMatchMessage("새 시즌 일정이 생성되었습니다.");
      setPendingMoments(null);
      setLatestPlayedMatch(null);
      onCareerChange(updatedCareer);
    } catch {
      setMatchError("아직 시즌을 마무리할 수 없습니다. 남은 경기를 먼저 완료해 주세요.");
    }
  };

  return (
    <ScreenShell
      eyebrow="커리어 대시보드"
      title={`${player.name} 선수`}
      actions={
        <>
          <button className="primary-button" type="button" onClick={onSaveCareer}>
            저장
          </button>
          <button className="danger-button" type="button" onClick={onDeleteSave}>
            저장 삭제
          </button>
        </>
      }
    >
      {saveError ? (
        <div className="save-alert" role="alert">
          {saveError}
        </div>
      ) : null}

      {saveMessage ? (
        <div className="save-status" role="status">
          {saveMessage}
        </div>
      ) : null}

      {actionError ? (
        <div className="save-alert" role="alert">
          {actionError}
        </div>
      ) : null}

      {matchError ? (
        <div className="save-alert" role="alert">
          {matchError}
        </div>
      ) : null}

      {matchMessage ? (
        <div className="save-status" role="status">
          {matchMessage}
        </div>
      ) : null}

      <section className="dashboard-section" aria-labelledby="weekly-status-title">
        <div className="section-heading">
          <span className="eyebrow">이번 주 일정</span>
          <h2 id="weekly-status-title">{career.currentWeek}주차</h2>
        </div>
        <div className="dashboard-grid">
          <article>
            <span>다음 상대</span>
            <strong>{opponentName}</strong>
          </article>
          <article>
            <span>컨디션</span>
            <strong>{career.condition}</strong>
          </article>
          <article>
            <span>피로도</span>
            <strong>{career.fatigue}</strong>
          </article>
          <article>
            <span>폼</span>
            <strong>{career.form}</strong>
          </article>
          <article>
            <span>감독 신뢰</span>
            <strong>{career.coachTrust}</strong>
          </article>
          <article>
            <span>팬 지지</span>
            <strong>{career.fanSupport}</strong>
          </article>
          <article>
            <span>전술 적응도</span>
            <strong>{career.tacticalFit ?? 42}</strong>
          </article>
          <article>
            <span>이번 주 경기</span>
            <strong>{currentPlayerMatch ? (hasPlayedCurrentMatch ? "완료" : "있음") : "없음"}</strong>
          </article>
        </div>
      </section>

      {seasonSummary ? (
        <SeasonSummaryPanel summary={seasonSummary} onStartNextSeason={beginNextSeason} />
      ) : null}

      {!seasonComplete ? (
      <section className="weekly-action-panel" aria-labelledby="weekly-action-title">
        <div className="section-heading">
          <span className="eyebrow">주간 포커스</span>
          <h2 id="weekly-action-title">이번 주 행동 선택</h2>
        </div>
        <div className="weekly-action-controls">
          <label>
            주간 행동
            <select
              value={selectedAction}
              onChange={(event) => setSelectedAction(event.target.value as WeeklyActionType)}
              disabled={weeklyActionCompleted}
            >
              {career.availableWeeklyActions.map((action) => (
                <option key={action.type} value={action.type}>
                  {action.label}
                </option>
              ))}
            </select>
          </label>

          {selectedAction === "individualTraining" ? (
            <label>
              훈련 능력치
              <select
                value={selectedAttribute}
                onChange={(event) => setSelectedAttribute(event.target.value as AttributeFocus)}
                disabled={weeklyActionCompleted}
              >
                {ATTRIBUTE_FOCUS_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="form-actions">
          <button
            className="primary-button"
            type="button"
            onClick={completeWeeklyAction}
            disabled={weeklyActionCompleted}
          >
            주간 행동 완료
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={prepareMatchSimulation}
            disabled={!canSimulateMatch || Boolean(pendingMoments)}
          >
            경기 시뮬레이션
          </button>
          {hasPlayedCurrentMatch ? (
            <button
              className="secondary-button"
              type="button"
              onClick={moveToNextWeek}
              disabled={!canAdvanceToNextWeek}
            >
              다음 주로
            </button>
          ) : null}
        </div>
      </section>
      ) : null}

      {pendingMoments ? (
        <section className="match-panel" aria-labelledby="moment-choice-title">
          <div className="section-heading">
            <span className="eyebrow">경기 시뮬레이션</span>
            <h2 id="moment-choice-title">핵심 장면 선택</h2>
          </div>
          <ol className="moment-choice-list">
            {pendingMoments.map((moment) => (
              <li key={moment.id}>
                <span>{moment.minute}분</span>
                <p>{moment.situation}</p>
                <select
                  value={selectedChoices[moment.id]}
                  onChange={(event) => updateMomentChoice(moment.id, event.target.value)}
                >
                  {moment.choices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ol>
          <button className="primary-button" type="button" onClick={simulateMatch}>
            선택 완료 후 경기 진행
          </button>
        </section>
      ) : null}

      {matchWithResult?.result ? <MatchResultPanel match={matchWithResult} /> : null}

      <DevelopmentReportPanel career={career} />

      <CareerHistoryPanel career={career} />

      <section className="dashboard-section" aria-labelledby="player-info-title">
        <div className="section-heading">
          <span className="eyebrow">선수 정보</span>
          <h2 id="player-info-title">프로필</h2>
        </div>
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
            <span>평판</span>
            <strong>{career.reputation}</strong>
          </article>
          <article>
            <span>최근 저장</span>
            <strong>{savedAtLabel ?? "아직 없음"}</strong>
          </article>
        </div>
      </section>

      <section className="event-log" aria-labelledby="event-log-title">
        <div className="section-heading">
          <span className="eyebrow">기록</span>
          <h2 id="event-log-title">이벤트 로그</h2>
        </div>
        <ol>
          {(career.eventLog ?? []).slice().reverse().map((event) => (
            <li key={event.id}>
              <span>{event.week}주차</span>
              <strong>{event.title}</strong>
              <p>{event.description}</p>
            </li>
          ))}
        </ol>
      </section>
    </ScreenShell>
  );
}
