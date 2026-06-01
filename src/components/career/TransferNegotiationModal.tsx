import { POSITION_LABELS, SQUAD_ROLE_LABELS } from "../../domain/player";
import type { TransferNegotiationAction } from "../../domain/negotiation";
import type { Club, TransferOffer } from "../../domain/types";
import { TeamNameLink } from "../TeamNameLink";

function formatMoney(value?: number): string {
  return typeof value === "number" ? `${value.toLocaleString("ko-KR")}만` : "-";
}

interface TransferNegotiationModalProps {
  offer: TransferOffer;
  currentClub: Club;
  onClose: () => void;
  onAction: (action: TransferNegotiationAction) => void;
  onOpenTeam?: (clubId: string) => void;
}

export function TransferNegotiationModal({
  offer,
  currentClub,
  onClose,
  onAction,
  onOpenTeam,
}: TransferNegotiationModalProps) {
  const terms = offer.negotiation.currentTerms;
  const offeredClubName = onOpenTeam ? (
    <TeamNameLink clubId={offer.clubId} onOpenTeam={onOpenTeam}>
      {offer.clubName}
    </TeamNameLink>
  ) : (
    offer.clubName
  );
  const currentClubName = onOpenTeam ? (
    <TeamNameLink clubId={currentClub.id} onOpenTeam={onOpenTeam}>
      {currentClub.name}
    </TeamNameLink>
  ) : (
    currentClub.name
  );

  return (
    <div className="modal-backdrop">
      <section className="negotiation-modal" role="dialog" aria-modal="true" aria-labelledby="negotiation-title">
        <header className="modal-header">
          <div>
            <p>이적 협상</p>
            <h2 id="negotiation-title">{offeredClubName}</h2>
          </div>
          <button className="secondary-button modal-close-button" type="button" onClick={onClose}>
            닫기
          </button>
        </header>

        <div className="negotiation-modal-body">
          <dl className="negotiation-term-grid">
            <div>
              <dt>제안 구단</dt>
              <dd>{offeredClubName}</dd>
            </div>
            <div>
              <dt>현재 구단</dt>
              <dd>{currentClubName}</dd>
            </div>
            <div>
              <dt>이적료</dt>
              <dd>{formatMoney(offer.transferFee)}</dd>
            </div>
            <div>
              <dt>연봉</dt>
              <dd>{formatMoney(terms.salary)}</dd>
            </div>
            <div>
              <dt>계약 기간</dt>
              <dd>{terms.contractYears}년</dd>
            </div>
            <div>
              <dt>스쿼드 역할</dt>
              <dd>{SQUAD_ROLE_LABELS[terms.squadRole]}</dd>
            </div>
            <div>
              <dt>약속 포지션</dt>
              <dd>{terms.promisedPosition ? POSITION_LABELS[terms.promisedPosition] : "-"}</dd>
            </div>
            <div>
              <dt>바이아웃</dt>
              <dd>{formatMoney(terms.releaseClause)}</dd>
            </div>
          </dl>

          <div className="negotiation-action-grid">
            <button className="secondary-button" type="button" onClick={() => onAction("salary_raise")}>
              연봉 인상 요구
            </button>
            <button className="secondary-button" type="button" onClick={() => onAction("playing_time")}>
              출전 시간 보장 요구
            </button>
            <button className="secondary-button" type="button" onClick={() => onAction("contract_length")}>
              계약 기간 조정
            </button>
            <button className="secondary-button" type="button" onClick={() => onAction("release_clause")}>
              바이아웃 삽입 요구
            </button>
            <button className="primary-button" type="button" onClick={() => onAction("accept")}>
              즉시 수락
            </button>
            <button className="danger-button" type="button" onClick={() => onAction("reject")}>
              거절
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
