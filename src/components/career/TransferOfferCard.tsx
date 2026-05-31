import { getLeagueName } from "../../data/fictionalLeagues";
import { POSITION_LABELS, SQUAD_ROLE_LABELS } from "../../domain/player";
import { isTransferOfferActionable } from "../../domain/transfers";
import type { TransferOffer } from "../../domain/types";
import { TeamNameLink } from "../TeamNameLink";

function formatMoney(value?: number): string {
  return typeof value === "number" ? `${value.toLocaleString("ko-KR")}만` : "-";
}

function getStatusLabel(offer: TransferOffer): string {
  switch (offer.negotiation.status) {
    case "accepted":
      return "수락됨";
    case "rejected":
      return "거절됨";
    case "withdrawn":
      return "철회됨";
    case "expired":
      return "만료됨";
    case "countered":
      return "역제안 도착";
    default:
      return "검토 필요";
  }
}

export interface TransferOfferCardProps {
  offer: TransferOffer;
  onNegotiate: (offerId: string) => void;
  onAccept: (offerId: string) => void;
  onReject: (offerId: string) => void;
  onHold: (offerId: string) => void;
  onOpenTeam?: (clubId: string) => void;
}

export function TransferOfferCard({
  offer,
  onNegotiate,
  onAccept,
  onReject,
  onHold,
  onOpenTeam,
}: TransferOfferCardProps) {
  const terms = offer.negotiation.currentTerms;
  const actionable = isTransferOfferActionable(offer);

  return (
    <article className="feed-item-card transfer-offer-card feed-transfer_offer">
      <div className="feed-item-meta">
        <span>이적 제안</span>
        <span>{getStatusLabel(offer)}</span>
        <time dateTime={offer.negotiation.updatedAt}>{new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(new Date(offer.negotiation.updatedAt))}</time>
      </div>

      <div className="feed-item-copy">
        <h3>
          {onOpenTeam ? (
            <TeamNameLink clubId={offer.clubId} onOpenTeam={onOpenTeam}>
              {offer.clubName}
            </TeamNameLink>
          ) : (
            offer.clubName
          )}
        </h3>
        <p>
          {getLeagueName(offer.leagueId)} · {SQUAD_ROLE_LABELS[terms.squadRole]} · 연봉 {formatMoney(terms.salary)}
        </p>
      </div>

      <dl className="transfer-offer-terms">
        <div>
          <dt>이적료</dt>
          <dd>{formatMoney(offer.transferFee)}</dd>
        </div>
        <div>
          <dt>계약</dt>
          <dd>{terms.contractYears}년</dd>
        </div>
        <div>
          <dt>포지션</dt>
          <dd>{terms.promisedPosition ? POSITION_LABELS[terms.promisedPosition] : "-"}</dd>
        </div>
      </dl>

      {actionable ? (
        <div className="feed-action-row">
          <button className="secondary-button" type="button" onClick={() => onNegotiate(offer.id)}>
            협상
          </button>
          <button className="primary-button" type="button" onClick={() => onAccept(offer.id)}>
            수락
          </button>
          <button className="danger-button" type="button" onClick={() => onReject(offer.id)}>
            거절
          </button>
          <button className="secondary-button" type="button" onClick={() => onHold(offer.id)}>
            보류
          </button>
        </div>
      ) : null}
    </article>
  );
}
