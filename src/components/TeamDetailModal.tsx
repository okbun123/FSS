import { formatStars, getPublicClubStars } from "../domain/clubPublicInfo";
import type { CareerState } from "../domain/types";
import { getTeamDetail, type TeamLeagueMovement } from "../domain/teamDetails";
import { TeamNameLink } from "./TeamNameLink";

interface TeamDetailModalProps {
  career: CareerState;
  clubId: string;
  onClose: () => void;
  onOpenTeam: (clubId: string) => void;
}

const MOVEMENT_LABELS: Record<TeamLeagueMovement, string> = {
  promoted: "승격",
  relegated: "강등",
  stayed: "잔류",
  unknown: "기록 없음",
};

function formatDate(dateIso: string): string {
  const date = new Date(dateIso);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

export function TeamDetailModal({
  career,
  clubId,
  onClose,
  onOpenTeam,
}: TeamDetailModalProps) {
  const detail = getTeamDetail(career, clubId);
  const club = career.clubs[clubId];
  const stars = club ? getPublicClubStars(club) : undefined;

  if (!detail || !club || !stars) {
    return (
      <div className="modal-backdrop">
        <section className="team-detail-modal" role="dialog" aria-modal="true" aria-labelledby="team-detail-title">
          <header className="modal-header">
            <div>
              <p>팀 상세</p>
              <h2 id="team-detail-title">팀 정보</h2>
            </div>
            <button className="secondary-button modal-close-button" type="button" onClick={onClose}>
              닫기
            </button>
          </header>
          <p className="empty-note">팀 정보를 찾을 수 없습니다.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <section className="team-detail-modal" role="dialog" aria-modal="true" aria-labelledby="team-detail-title">
        <header className="modal-header">
          <div>
            <p>{detail.shortName} · {detail.league}</p>
            <h2 id="team-detail-title">{detail.name}</h2>
          </div>
          <button className="secondary-button modal-close-button" type="button" onClick={onClose}>
            닫기
          </button>
        </header>

        <dl className="team-detail-grid">
          <div>
            <dt>리그</dt>
            <dd>{detail.league}</dd>
          </div>
          <div>
            <dt>평판</dt>
            <dd>{formatStars(stars.reputationStars)}</dd>
          </div>
          <div>
            <dt>예산</dt>
            <dd>{formatStars(stars.budgetStars)}</dd>
          </div>
          <div>
            <dt>스쿼드</dt>
            <dd>{formatStars(stars.squadStrengthStars)}</dd>
          </div>
          <div>
            <dt>유스 기회</dt>
            <dd>{formatStars(stars.youthOpportunityStars)}</dd>
          </div>
          <div>
            <dt>훈련 환경</dt>
            <dd>{formatStars(stars.trainingFacilityStars)}</dd>
          </div>
        </dl>

        <section className="team-detail-section">
          <h3>최근 5경기</h3>
          {detail.recentMatches.length === 0 ? (
            <p className="empty-note">아직 치른 경기가 없습니다.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">결과</th>
                    <th scope="col">스코어</th>
                    <th scope="col">상대</th>
                    <th scope="col">대회</th>
                    <th scope="col">날짜</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recentMatches.map((match) => (
                    <tr key={match.fixtureId}>
                      <td>{match.outcome}</td>
                      <td>{match.score}</td>
                      <td>
                        <TeamNameLink clubId={match.opponentClubId} onOpenTeam={onOpenTeam}>
                          {match.opponentName}
                        </TeamNameLink>
                      </td>
                      <td>{match.competitionName}</td>
                      <td>{formatDate(match.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="team-detail-section">
          <h3>지난 시즌</h3>
          {detail.lastSeasonResult.fallback ? (
            <p className="empty-note">지난 시즌 기록이 아직 없습니다.</p>
          ) : (
            <dl className="team-detail-grid compact">
              <div>
                <dt>최종 순위</dt>
                <dd>{detail.lastSeasonResult.finalLeaguePosition ? `${detail.lastSeasonResult.finalLeaguePosition}위` : "-"}</dd>
              </div>
              <div>
                <dt>예상 순위</dt>
                <dd>{detail.lastSeasonResult.predictedFinish ? `${detail.lastSeasonResult.predictedFinish}위` : "-"}</dd>
              </div>
              <div>
                <dt>리그 결과</dt>
                <dd>{MOVEMENT_LABELS[detail.lastSeasonResult.movement]}</dd>
              </div>
              <div>
                <dt>국내 컵</dt>
                <dd>{detail.lastSeasonResult.cupResult ?? "해당 없음"}</dd>
              </div>
              <div>
                <dt>대륙 컵</dt>
                <dd>{detail.lastSeasonResult.continentalResult ?? "해당 없음"}</dd>
              </div>
            </dl>
          )}
        </section>

        <section className="team-detail-section">
          <h3>참가 대회</h3>
          <dl className="team-detail-grid compact">
            <div>
              <dt>리그</dt>
              <dd>{detail.competitionsEntered.league}</dd>
            </div>
            <div>
              <dt>국내 컵</dt>
              <dd>{detail.competitionsEntered.domesticCups.join(", ") || "등록된 국내 컵 없음"}</dd>
            </div>
            {detail.competitionsEntered.continentalCups.length > 0 ? (
              <div>
                <dt>대륙 컵</dt>
                <dd>{detail.competitionsEntered.continentalCups.join(", ")}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      </section>
    </div>
  );
}
