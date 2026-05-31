import { useMemo, useState } from "react";
import { AttributeTable } from "../components/career/AttributeTable";
import { MetricGrid, type MetricItem } from "../components/career/MetricGrid";
import { ScreenShell } from "../components/ScreenShell";
import { getClubName, getLeagueName } from "../data/fictionalLeagues";
import {
  getDominantFootLabel,
  getPotentialHint,
  PERSONALITY_LABELS,
  POSITION_LABELS,
  SQUAD_ROLE_LABELS,
} from "../domain/player";
import type { CareerHistoryEntry, CareerState, Fixture, LeagueTableRow, MonthlyEvent } from "../domain/types";
import {
  advanceMonth,
  getCurrentClub,
  getCurrentLeague,
  getCurrentMonthFixtures,
  getNextPlayerFixture,
  startNextSeason,
} from "../game/monthlyCareer";
import { calculateOverall } from "../game/overall";

interface CareerDashboardScreenProps {
  career: CareerState;
  savedAtLabel: string | null;
  saveError: string | null;
  saveMessage: string | null;
  onCareerChange: (career: CareerState) => void;
  onDeleteSave: () => void;
  onSaveCareer: () => void;
}

export type DashboardTab = "main" | "player" | "schedule" | "career" | "club";

export const CAREER_DASHBOARD_TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: "main", label: "메인" },
  { id: "player", label: "선수 상태" },
  { id: "schedule", label: "경기 일정" },
  { id: "career", label: "커리어" },
  { id: "club", label: "소속팀/리그" },
];

function formatMonth(career: CareerState): string {
  if (career.season.isComplete) {
    return "시즌 종료";
  }

  return career.season.months.find((month) => month.month === career.season.currentMonth)?.label ?? `${career.season.currentMonth}월`;
}

function formatFixture(fixture?: Fixture): string {
  if (!fixture) {
    return "예정 경기 없음";
  }

  return `${getClubName(fixture.homeClubId)} vs ${getClubName(fixture.awayClubId)}`;
}

function resultText(fixture: Fixture): string {
  if (!fixture.result) {
    return "예정";
  }

  return `${fixture.result.homeGoals}-${fixture.result.awayGoals}`;
}

function appearanceText(fixture: Fixture): string {
  if (!fixture.result?.playerAppeared) {
    return "미출전";
  }

  return `${fixture.result.playerMinutes ?? 0}분 · 평점 ${(fixture.result.playerRating ?? 0).toFixed(1)} · ${fixture.result.playerGoals ?? 0}골 ${fixture.result.playerAssists ?? 0}도움`;
}

function DataTable({
  columns,
  rows,
  emptyMessage = "표시할 데이터가 없습니다.",
}: {
  columns: string[];
  rows: Array<Array<string | number>>;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <p className="empty-note">{emptyMessage}</p>;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row.join("-")}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cellIndex}-${cell}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventPanel({
  event,
  selectedChoiceId,
  onSelectChoice,
}: {
  event?: MonthlyEvent;
  selectedChoiceId: string | null;
  onSelectChoice: (choiceId: string) => void;
}) {
  if (!event) {
    return (
      <section className="data-panel event-panel">
        <h2>월간 이벤트</h2>
        <p className="empty-note">이번 달에는 큰 의사결정 이벤트가 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="data-panel event-panel">
      <h2>{event.title}</h2>
      <p>{event.description}</p>
      <div className="event-choice-grid">
        {event.choices.map((choice, index) => {
          const selected = selectedChoiceId ? selectedChoiceId === choice.id : index === 0;

          return (
            <button
              className={selected ? "event-choice selected" : "event-choice"}
              key={choice.id}
              type="button"
              onClick={() => onSelectChoice(choice.id)}
            >
              <strong>{choice.label}</strong>
              <span>{choice.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PanelList({
  items,
  emptyMessage,
}: {
  items: Array<{ id: string; title: string; description: string; className?: string }>;
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <p className="empty-note">{emptyMessage}</p>;
  }

  return (
    <ol className="simple-list">
      {items.map((item) => (
        <li className={item.className} key={item.id}>
          <strong>{item.title}</strong>
          <span>{item.description}</span>
        </li>
      ))}
    </ol>
  );
}

function MainTab({
  career,
  selectedChoiceId,
  onSelectChoice,
  onAdvanceMonth,
  onStartNextSeason,
}: {
  career: CareerState;
  selectedChoiceId: string | null;
  onSelectChoice: (choiceId: string) => void;
  onAdvanceMonth: () => void;
  onStartNextSeason: () => void;
}) {
  const nextFixture = getNextPlayerFixture(career);
  const currentMonthFixtures = getCurrentMonthFixtures(career);
  const recentGrowth = career.monthlyDevelopmentLog.at(-1)?.entries.slice(0, 6) ?? [];
  const notices = career.notices.slice(-5).reverse();
  const eventLog = career.eventLog.slice(-5).reverse();
  const transferOffers = career.transferOffers.slice(-4).reverse();

  return (
    <div className="career-main-grid">
      <div className="career-primary-column">
        <section className="data-panel dashboard-summary">
          <div>
            <h2>{career.season.year} 시즌 · {formatMonth(career)}</h2>
            <p>{getCurrentClub(career).name} · {getLeagueName(getCurrentClub(career).leagueId)}</p>
          </div>
          <MetricGrid
            items={[
              { label: "다음 경기", value: formatFixture(nextFixture) },
              { label: "이번 달 경기", value: `${currentMonthFixtures.length}경기` },
              { label: "폼", value: career.player.form, tone: career.player.form >= 65 ? "good" : "default" },
              { label: "컨디션", value: career.player.condition, tone: career.player.condition >= 75 ? "good" : "default" },
              { label: "피로", value: career.player.fatigue, tone: career.player.fatigue >= 70 ? "warning" : "default" },
              { label: "감독 신뢰", value: career.player.coachTrust },
            ]}
          />
          <div className="quick-action-row">
            {career.season.isComplete ? (
              <button className="primary-button" type="button" onClick={onStartNextSeason}>
                다음 시즌 시작
              </button>
            ) : (
              <button className="primary-button" type="button" onClick={onAdvanceMonth}>
                다음 달로 진행
              </button>
            )}
          </div>
        </section>

        <EventPanel event={career.currentEvent} selectedChoiceId={selectedChoiceId} onSelectChoice={onSelectChoice} />

        <section className="data-panel">
          <h2>최근 능력치 변화</h2>
          {recentGrowth.length === 0 ? (
            <p className="empty-note">아직 성장 리포트가 없습니다.</p>
          ) : (
            <dl className="growth-list">
              {recentGrowth.map((entry) => (
                <div key={entry.attribute}>
                  <dt>{entry.label}</dt>
                  <dd>+{entry.amount.toFixed(2)}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>

      <div className="career-side-column">
        <section className="data-panel">
          <h2>이적 제안</h2>
          <PanelList
            emptyMessage="현재 공식 이적 제안은 없습니다."
            items={transferOffers.map((offer) => ({
              id: offer.id,
              title: offer.clubName,
              description: `${getLeagueName(offer.leagueId)} · ${SQUAD_ROLE_LABELS[offer.squadRole]} · 연봉 ${offer.salary.toLocaleString("ko-KR")}만`,
            }))}
          />
        </section>

        <section className="data-panel">
          <h2>긴급 알림</h2>
          <PanelList
            emptyMessage="새 알림이 없습니다."
            items={notices.map((notice) => ({
              id: notice.id,
              title: notice.title,
              description: notice.description,
              className: `notice-${notice.tone}`,
            }))}
          />
        </section>

        <section className="data-panel">
          <h2>진행 로그</h2>
          <PanelList
            emptyMessage="아직 진행 로그가 없습니다."
            items={eventLog.map((entry) => ({
              id: entry.id,
              title: entry.title,
              description: entry.description,
            }))}
          />
        </section>
      </div>
    </div>
  );
}

function PlayerTab({ career }: { career: CareerState }) {
  const club = getCurrentClub(career);
  const league = getCurrentLeague(career);
  const ovr = calculateOverall(career.player);
  const profileItems: MetricItem[] = [
    { label: "선수", value: career.player.name },
    { label: "나이", value: `${career.player.age}세` },
    { label: "국적", value: career.player.nationality },
    { label: "소속팀", value: club.name },
    { label: "리그", value: league.name },
    { label: "포지션", value: `${career.player.selectedPosition} · ${POSITION_LABELS[career.player.selectedPosition]}` },
    { label: "OVR", value: ovr, tone: ovr >= 70 ? "good" : "default" },
    { label: "잠재력", value: getPotentialHint(career.player.potential), tone: career.player.potential >= 88 ? "good" : "default" },
    { label: "주발", value: getDominantFootLabel(career.player) },
    { label: "왼발", value: career.player.leftFoot },
    { label: "오른발", value: career.player.rightFoot },
    { label: "성격", value: PERSONALITY_LABELS[career.player.personality] },
    { label: "폼", value: career.player.form },
    { label: "컨디션", value: career.player.condition },
    { label: "피로", value: career.player.fatigue, tone: career.player.fatigue >= 70 ? "warning" : "default" },
    { label: "평판", value: career.player.reputation },
    { label: "감독 신뢰", value: career.player.coachTrust },
    { label: "시장 가치", value: `${career.player.marketValue.toLocaleString("ko-KR")}만` },
    { label: "부상", value: career.injury.severity === "healthy" ? "건강" : career.injury.description ?? "관리 필요" },
  ];

  return (
    <div className="career-two-column">
      <section className="data-panel">
        <h2>선수 프로필</h2>
        <MetricGrid items={profileItems} />
      </section>
      <section className="data-panel attribute-panel">
        <h2>전체 능력치</h2>
        <AttributeTable attributes={career.player.attributes} />
      </section>
    </div>
  );
}

function ScheduleTab({ career }: { career: CareerState }) {
  const currentClub = getCurrentClub(career);
  const leagueFixtures = career.season.fixtures.filter((fixture) => fixture.leagueId === currentClub.leagueId);
  const playerFixtures = leagueFixtures.filter(
    (fixture) => fixture.homeClubId === currentClub.id || fixture.awayClubId === currentClub.id,
  );
  const playedPlayerFixtures = playerFixtures.filter((fixture) => fixture.status === "played").slice().reverse();
  const nextFixture = getNextPlayerFixture(career);

  return (
    <div className="career-two-column">
      <section className="data-panel highlight-panel">
        <h2>다음 경기</h2>
        <MetricGrid
          items={[
            { label: "대진", value: formatFixture(nextFixture) },
            { label: "현재 월", value: formatMonth(career) },
            { label: "남은 경기", value: playerFixtures.filter((fixture) => fixture.status === "scheduled").length },
          ]}
        />
      </section>

      <section className="data-panel">
        <h2>월별 캘린더</h2>
        <DataTable
          columns={["월", "리그 경기", "우리 팀 경기", "진행 상태"]}
          rows={career.season.months.map((month) => {
            const monthPlayerFixtures = playerFixtures.filter((fixture) => fixture.month === month.month);
            const completed = monthPlayerFixtures.filter((fixture) => fixture.status === "played").length;

            return [
              month.label,
              leagueFixtures.filter((fixture) => fixture.month === month.month).length,
              monthPlayerFixtures.length,
              month.month < career.season.currentMonth ? `${completed}/${monthPlayerFixtures.length} 완료` : month.month === career.season.currentMonth ? "진행 중" : "예정",
            ];
          })}
        />
      </section>

      <section className="data-panel wide-panel">
        <h2>최근 결과와 출전 기록</h2>
        <DataTable
          columns={["라운드", "월", "경기", "결과", "출전/평점"]}
          rows={playedPlayerFixtures.slice(0, 12).map((fixture) => [
            fixture.round,
            `${fixture.month}월`,
            formatFixture(fixture),
            resultText(fixture),
            appearanceText(fixture),
          ])}
          emptyMessage="아직 치른 경기가 없습니다."
        />
      </section>

      <section className="data-panel wide-panel">
        <h2>소속 리그 일정</h2>
        <DataTable
          columns={["라운드", "월", "홈", "원정", "상태"]}
          rows={leagueFixtures.slice(0, 120).map((fixture) => [
            fixture.round,
            `${fixture.month}월`,
            getClubName(fixture.homeClubId),
            getClubName(fixture.awayClubId),
            fixture.status === "played" ? resultText(fixture) : "예정",
          ])}
        />
      </section>
    </div>
  );
}

function getCareerTotals(career: CareerState) {
  return career.careerHistory.reduce(
    (totals, entry) => ({
      appearances: totals.appearances + entry.appearances,
      goals: totals.goals + entry.goals,
      assists: totals.assists + entry.assists,
      ratingTotal: totals.ratingTotal + entry.averageRating * entry.appearances,
      ratingApps: totals.ratingApps + entry.appearances,
    }),
    {
      appearances: career.seasonStats.appearances,
      goals: career.seasonStats.goals,
      assists: career.seasonStats.assists,
      ratingTotal: career.seasonStats.averageRating * career.seasonStats.appearances,
      ratingApps: career.seasonStats.appearances,
    },
  );
}

function CareerTab({ career }: { career: CareerState }) {
  const totals = getCareerTotals(career);
  const totalAverageRating = totals.ratingApps > 0 ? totals.ratingTotal / totals.ratingApps : 0;
  const milestones = [
    ...career.careerHistory
      .filter((entry): entry is CareerHistoryEntry & { achievement: string } => Boolean(entry.achievement))
      .map((entry) => ({
        id: entry.id,
        title: entry.achievement,
        description: `${entry.year} · ${entry.clubName} · ${entry.leagueName}`,
      })),
    ...career.eventLog.slice(-6).map((entry) => ({
      id: entry.id,
      title: entry.title,
      description: entry.description,
    })),
  ].slice(-8).reverse();

  return (
    <div className="career-two-column">
      <section className="data-panel">
        <h2>이번 시즌 기록</h2>
        <MetricGrid
          items={[
            { label: "출전", value: `${career.seasonStats.appearances}경기` },
            { label: "출전 시간", value: `${career.seasonStats.minutesPlayed}분` },
            { label: "골", value: career.seasonStats.goals },
            { label: "도움", value: career.seasonStats.assists },
            { label: "평균 평점", value: career.seasonStats.averageRating.toFixed(2) },
            { label: "계약", value: `${career.contractYearsLeft}년 남음` },
            { label: "연봉", value: `${career.salary.toLocaleString("ko-KR")}만` },
            { label: "역할", value: SQUAD_ROLE_LABELS[career.squadRole] },
          ]}
        />
      </section>

      <section className="data-panel">
        <h2>커리어 합산</h2>
        <MetricGrid
          items={[
            { label: "총 출전", value: `${totals.appearances}경기` },
            { label: "총 골", value: totals.goals },
            { label: "총 도움", value: totals.assists },
            { label: "통산 평점", value: totalAverageRating.toFixed(2) },
            { label: "소속 클럽 수", value: new Set([...career.careerHistory.map((entry) => entry.clubId), career.player.clubId]).size },
            { label: "완료 시즌", value: career.careerHistory.length },
          ]}
        />
      </section>

      <section className="data-panel wide-panel">
        <h2>시즌/클럽 히스토리</h2>
        <DataTable
          columns={["시즌", "클럽", "리그", "순위", "출전", "골", "도움", "평점", "업적"]}
          rows={career.careerHistory.map((entry) => [
            `${entry.year}`,
            entry.clubName,
            entry.leagueName,
            `${entry.leaguePosition}위`,
            entry.appearances,
            entry.goals,
            entry.assists,
            entry.averageRating.toFixed(2),
            entry.achievement ?? "-",
          ])}
          emptyMessage="완료된 시즌 기록이 없습니다."
        />
      </section>

      <section className="data-panel wide-panel">
        <h2>커리어 마일스톤</h2>
        <PanelList emptyMessage="아직 기록된 마일스톤이 없습니다." items={milestones} />
      </section>
    </div>
  );
}

function LeagueTable({ rows }: { rows: LeagueTableRow[] }) {
  return (
    <DataTable
      columns={["순위", "클럽", "경기", "승점", "승", "무", "패", "득실"]}
      rows={rows.map((row) => [
        row.position,
        row.clubName,
        row.played,
        row.points,
        row.wins,
        row.draws,
        row.losses,
        row.goalDifference,
      ])}
    />
  );
}

function ClubTab({ career }: { career: CareerState }) {
  const club = getCurrentClub(career);
  const table = career.season.tables[club.leagueId];
  const facilities = club.trainingFacilities;

  return (
    <div className="career-two-column">
      <section className="data-panel club-header">
        <h2>{club.name}</h2>
        <MetricGrid
          items={[
            { label: "도시/지역", value: club.city },
            { label: "리그", value: getLeagueName(club.leagueId) },
            { label: "약칭", value: club.shortName },
            { label: "대표 색", value: club.primaryColor },
            { label: "스쿼드 전력", value: club.squadStrength },
            { label: "평판", value: club.reputation },
            { label: "예산 수준", value: club.budgetLevel },
            { label: "유스 기회", value: club.youthOpportunity },
            { label: "플레이 스타일", value: club.playStyle },
            { label: "이적 정책", value: club.transferPolicy },
            { label: "평균 연령", value: `${club.squadSummary.averageAge}세` },
            { label: "선수층", value: club.squadSummary.depth },
          ]}
        />
      </section>

      <section className="data-panel">
        <h2>훈련 시설</h2>
        <MetricGrid
          items={[
            { label: "기술 훈련", value: facilities.technicalTraining },
            { label: "피지컬 훈련", value: facilities.physicalTraining },
            { label: "전술 훈련", value: facilities.tacticalTraining },
            { label: "멘탈 훈련", value: facilities.mentalTraining },
            { label: "유스 육성", value: facilities.youthDevelopment },
            { label: "의무 지원", value: facilities.medicalSupport },
          ]}
        />
      </section>

      <section className="data-panel wide-panel">
        <h2>리그 테이블</h2>
        <LeagueTable rows={table} />
      </section>

      <section className="data-panel wide-panel">
        <h2>승강 상태</h2>
        <p className="empty-note">
          {career.season.promotionRelegation?.note ?? "시즌이 끝나면 자동 강등 위험 팀과 승격 후보가 정리됩니다."}
        </p>
      </section>
    </div>
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
  const [activeTab, setActiveTab] = useState<DashboardTab>("main");
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const club = useMemo(() => getCurrentClub(career), [career]);

  const advance = () => {
    try {
      const updatedCareer = advanceMonth(career, {
        selectedChoiceId: selectedChoiceId ?? career.currentEvent?.choices[0]?.id,
      });
      setSelectedChoiceId(null);
      setActionError(null);
      setActionMessage(updatedCareer.season.isComplete ? "시즌이 종료되었습니다." : `${formatMonth(updatedCareer)}로 이동했습니다.`);
      onCareerChange(updatedCareer);
    } catch {
      setActionError("월간 진행을 처리하지 못했습니다. 저장 상태를 확인해 주세요.");
      setActionMessage(null);
    }
  };

  const nextSeason = () => {
    try {
      const updatedCareer = startNextSeason(career);
      setSelectedChoiceId(null);
      setActionError(null);
      setActionMessage("새 시즌이 시작되었습니다.");
      onCareerChange(updatedCareer);
    } catch {
      setActionError("아직 다음 시즌을 시작할 수 없습니다.");
      setActionMessage(null);
    }
  };

  return (
    <ScreenShell
      eyebrow={`${club.name} · ${career.season.year} 시즌`}
      title={career.player.name}
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
      wide
    >
      <div className="career-dashboard">
        {saveError ? <div className="save-alert" role="alert">{saveError}</div> : null}
        {saveMessage ? <div className="save-status" role="status">{saveMessage}</div> : null}
        {actionError ? <div className="save-alert" role="alert">{actionError}</div> : null}
        {actionMessage ? <div className="save-status" role="status">{actionMessage}</div> : null}

        <nav className="tab-bar" aria-label="커리어 탭">
          {CAREER_DASHBOARD_TABS.map((tab) => (
            <button
              className={activeTab === tab.id ? "tab-button active" : "tab-button"}
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "main" ? (
          <MainTab
            career={career}
            selectedChoiceId={selectedChoiceId}
            onSelectChoice={setSelectedChoiceId}
            onAdvanceMonth={advance}
            onStartNextSeason={nextSeason}
          />
        ) : null}
        {activeTab === "player" ? <PlayerTab career={career} /> : null}
        {activeTab === "schedule" ? <ScheduleTab career={career} /> : null}
        {activeTab === "career" ? <CareerTab career={career} /> : null}
        {activeTab === "club" ? <ClubTab career={career} /> : null}

        <p className="saved-at">최근 저장: {savedAtLabel ?? "아직 없음"}</p>
      </div>
    </ScreenShell>
  );
}
