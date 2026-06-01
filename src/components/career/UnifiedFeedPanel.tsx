import { createUnifiedFeedForCareer } from "../../domain/feed";
import { getClubName } from "../../data/fictionalLeagues";
import type { CareerState } from "../../domain/types";
import { TeamNameLink } from "../TeamNameLink";
import { FeedItemCard } from "./FeedItemCard";
import { TransferOfferCard } from "./TransferOfferCard";

interface UnifiedFeedPanelProps {
  career: CareerState;
  onNegotiateTransfer: (offerId: string) => void;
  onAcceptTransfer: (offerId: string) => void;
  onRejectTransfer: (offerId: string) => void;
  onHoldTransfer: (offerId: string) => void;
  onOpenTeam: (clubId: string) => void;
}

export function UnifiedFeedPanel({
  career,
  onNegotiateTransfer,
  onAcceptTransfer,
  onRejectTransfer,
  onHoldTransfer,
  onOpenTeam,
}: UnifiedFeedPanelProps) {
  const feedItems = career.unifiedFeed.length > 0 ? career.unifiedFeed : createUnifiedFeedForCareer(career);
  const offersById = new Map(career.transferOffers.map((offer) => [offer.id, offer]));
  const fixturesById = new Map(career.fixtures.map((fixture) => [fixture.id, fixture]));

  return (
    <section className="data-panel unified-feed-panel">
      <h2>알림 / 로그 / 제안</h2>
      <div className="feed-scroll">
        {feedItems.length === 0 ? (
          <p className="empty-note">아직 표시할 알림이 없습니다.</p>
        ) : (
          <ol className="unified-feed-list">
            {feedItems.map((item) => {
              const offer = item.type === "transfer_offer" && item.relatedEntityId
                ? offersById.get(item.relatedEntityId)
                : undefined;
              const fixture = item.type === "match" && item.relatedEntityId
                ? fixturesById.get(item.relatedEntityId)
                : undefined;
              const matchBody = fixture?.result ? (
                <>
                  <TeamNameLink clubId={fixture.homeClubId} onOpenTeam={onOpenTeam}>
                    {career.clubs[fixture.homeClubId]?.name ?? getClubName(fixture.homeClubId)}
                  </TeamNameLink>{" "}
                  {fixture.result.homeGoals}-{fixture.result.awayGoals}{" "}
                  <TeamNameLink clubId={fixture.awayClubId} onOpenTeam={onOpenTeam}>
                    {career.clubs[fixture.awayClubId]?.name ?? getClubName(fixture.awayClubId)}
                  </TeamNameLink>
                </>
              ) : undefined;

              return (
                <li key={item.id}>
                  {offer ? (
                    <TransferOfferCard
                      offer={offer}
                      onNegotiate={onNegotiateTransfer}
                      onAccept={onAcceptTransfer}
                      onReject={onRejectTransfer}
                      onHold={onHoldTransfer}
                      onOpenTeam={onOpenTeam}
                    />
                  ) : (
                    <FeedItemCard item={item} body={matchBody} />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
