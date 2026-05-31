import { getClubName } from "../../data/fictionalLeagues";
import type { CareerState, Fixture } from "../../domain/types";
import { TeamNameLink } from "../TeamNameLink";

interface PlayoffBracketPanelProps {
  career: CareerState;
  onOpenTeam: (clubId: string) => void;
}

function formatDate(dateIso: string): string {
  const date = new Date(dateIso);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function clubName(career: CareerState, clubId: string): string {
  return career.clubs[clubId]?.name ?? getClubName(clubId);
}

function renderClub(career: CareerState, clubId: string, onOpenTeam: (clubId: string) => void) {
  return (
    <TeamNameLink clubId={clubId} onOpenTeam={onOpenTeam}>
      {clubName(career, clubId)}
    </TeamNameLink>
  );
}

function fixtureScore(fixture: Fixture): string {
  if (!fixture.result) {
    return "예정";
  }

  const suffix = fixture.result.decidedBy === "extraTime"
    ? " 연장"
    : fixture.result.decidedBy === "penalties"
      ? ` 승부차기 ${fixture.result.homePenaltyGoals ?? 0}-${fixture.result.awayPenaltyGoals ?? 0}`
      : "";

  return `${fixture.result.homeGoals}-${fixture.result.awayGoals}${suffix}`;
}

export function PlayoffBracketPanel({ career, onOpenTeam }: PlayoffBracketPanelProps) {
  const playoffFixtures = career.season.fixtures
    .filter((fixture) => fixture.playoff)
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        (left.playoff?.leg ?? 0) - (right.playoff?.leg ?? 0) ||
        left.id.localeCompare(right.id),
    );

  if (playoffFixtures.length === 0) {
    return <p className="empty-note">아직 플레이오프 일정이 없습니다.</p>;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">단계</th>
            <th scope="col">날짜</th>
            <th scope="col">홈</th>
            <th scope="col">원정</th>
            <th scope="col">결과</th>
          </tr>
        </thead>
        <tbody>
          {playoffFixtures.map((fixture) => (
            <tr key={fixture.id}>
              <td>{fixture.playoff?.stage === "promotionRelegationPlayoff" ? "승강 PO" : "승격 PO"}</td>
              <td>{formatDate(fixture.date)}</td>
              <td>{renderClub(career, fixture.homeClubId, onOpenTeam)}</td>
              <td>{renderClub(career, fixture.awayClubId, onOpenTeam)}</td>
              <td>{fixtureScore(fixture)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
