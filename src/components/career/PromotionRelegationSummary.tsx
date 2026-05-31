import { getClubName } from "../../data/fictionalLeagues";
import type { CareerState } from "../../domain/types";
import { finalMovementSummary } from "../../domain/promotionRelegation";
import { TeamNameLink } from "../TeamNameLink";

interface PromotionRelegationSummaryProps {
  career: CareerState;
  onOpenTeam: (clubId: string) => void;
}

function clubName(career: CareerState, clubId: string): string {
  return career.clubs[clubId]?.name ?? getClubName(clubId);
}

function TeamList({
  career,
  clubIds,
  empty,
  onOpenTeam,
}: {
  career: CareerState;
  clubIds: readonly string[];
  empty: string;
  onOpenTeam: (clubId: string) => void;
}) {
  if (clubIds.length === 0) {
    return <span>{empty}</span>;
  }

  return (
    <span>
      {clubIds.map((clubId, index) => (
        <span key={clubId}>
          {index > 0 ? ", " : null}
          <TeamNameLink clubId={clubId} onOpenTeam={onOpenTeam}>
            {clubName(career, clubId)}
          </TeamNameLink>
        </span>
      ))}
    </span>
  );
}

function decisionText(decidedBy?: string): string {
  if (decidedBy === "higherSeed") {
    return "상위 시드";
  }

  if (decidedBy === "extraTime") {
    return "연장";
  }

  if (decidedBy === "penalties") {
    return "승부차기";
  }

  return "정규 시간";
}

export function PromotionRelegationSummary({ career, onOpenTeam }: PromotionRelegationSummaryProps) {
  const status = career.season.promotionRelegation;
  const movement = finalMovementSummary(status);
  const playoffResults = status?.playoffResults ?? [];

  if (!status) {
    return <p className="empty-note">정규 시즌 종료 후 승강 정보가 표시됩니다.</p>;
  }

  return (
    <div className="promotion-summary">
      <dl className="summary-list">
        <div>
          <dt>승격</dt>
          <dd>
            <TeamList career={career} clubIds={movement.promotedClubIds} empty="미확정" onOpenTeam={onOpenTeam} />
          </dd>
        </div>
        <div>
          <dt>강등</dt>
          <dd>
            <TeamList career={career} clubIds={movement.relegatedClubIds} empty="미확정" onOpenTeam={onOpenTeam} />
          </dd>
        </div>
        <div>
          <dt>플레이오프</dt>
          <dd>
            <TeamList career={career} clubIds={movement.playoffClubIds} empty="대상 없음" onOpenTeam={onOpenTeam} />
          </dd>
        </div>
      </dl>
      <p className="empty-note">{status.note}</p>
      {playoffResults.length > 0 ? (
        <ol className="simple-list">
          {playoffResults.map((result) => (
            <li key={result.id}>
              <strong>{result.name}</strong>
              <span>
                {result.winnerClubId ? (
                  <>
                    {clubName(career, result.winnerClubId)} 승리 · {decisionText(result.decidedBy)}
                  </>
                ) : (
                  "진행 중"
                )}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
