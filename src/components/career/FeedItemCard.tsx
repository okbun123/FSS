import type { ReactNode } from "react";
import type { UnifiedFeedItem, UnifiedFeedPriority } from "../../domain/types";

const TYPE_LABELS: Record<UnifiedFeedItem["type"], string> = {
  urgent: "긴급",
  log: "로그",
  transfer_offer: "제안",
  contract_offer: "계약",
  injury: "부상",
  match: "경기",
  development: "성장",
  league: "리그",
  system: "시스템",
};

const PRIORITY_LABELS: Record<UnifiedFeedPriority, string> = {
  critical: "중요",
  high: "높음",
  normal: "보통",
  low: "낮음",
};

function formatDate(dateIso: string): string {
  const date = new Date(dateIso);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

export function FeedItemCard({ item, body }: { item: UnifiedFeedItem; body?: ReactNode }) {
  return (
    <article className={`feed-item-card feed-${item.type} feed-priority-${item.priority}`}>
      <div className="feed-item-meta">
        <span>{TYPE_LABELS[item.type]}</span>
        <span>{PRIORITY_LABELS[item.priority]}</span>
        <time dateTime={item.date}>{formatDate(item.date)}</time>
      </div>
      <div className="feed-item-copy">
        <h3>{item.title}</h3>
        <p>{body ?? item.body}</p>
      </div>
    </article>
  );
}
