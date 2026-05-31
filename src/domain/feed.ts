import { getClubName } from "../data/fictionalLeagues";
import type {
  CareerEventLogEntry,
  CareerState,
  DevelopmentReport,
  IsoDateString,
  MonthlyNotice,
  RecentResult,
  TransferOffer,
  UnifiedFeedItem,
  UnifiedFeedItemType,
  UnifiedFeedPriority,
} from "./types";

const FEED_LIMIT = 120;

const PRIORITY_WEIGHT: Record<UnifiedFeedPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

function isoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function getMonthStartDate(year: number, month: number): string {
  return isoDate(year, Math.min(Math.max(month, 1), 12), 1);
}

function mapNoticePriority(tone: MonthlyNotice["tone"]): UnifiedFeedPriority {
  if (tone === "warning") {
    return "critical";
  }

  return tone === "success" ? "normal" : "high";
}

function mapEventLogType(type: CareerEventLogEntry["type"]): UnifiedFeedItemType {
  switch (type) {
    case "injury_warning":
      return "injury";
    case "training_report":
    case "first_team_chance":
    case "tactical_role_change":
      return "development";
    case "contract_discussion":
      return "contract_offer";
    case "season_start":
    case "season_complete":
      return "league";
    case "transfer_offer":
    case "transfer_negotiation":
    case "transfer_completed":
      return "log";
    default:
      return "log";
  }
}

function mapEventLogPriority(type: CareerEventLogEntry["type"]): UnifiedFeedPriority {
  switch (type) {
    case "injury_warning":
      return "critical";
    case "contract_discussion":
    case "transfer_offer":
    case "transfer_negotiation":
    case "transfer_completed":
      return "high";
    case "season_complete":
    case "season_start":
      return "normal";
    default:
      return "low";
  }
}

function getOfferStatusLabel(offer: TransferOffer): string {
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
      return "역제안";
    default:
      return "검토 필요";
  }
}

function isActionableOffer(offer: TransferOffer): boolean {
  return offer.negotiation.status === "open" || offer.negotiation.status === "countered";
}

function createNoticeItem(notice: MonthlyNotice, seasonYear: number): UnifiedFeedItem {
  return {
    id: `notice-${notice.id}`,
    type: notice.tone === "warning" ? "urgent" : "system",
    date: getMonthStartDate(seasonYear, notice.month),
    title: notice.title,
    body: notice.description,
    priority: mapNoticePriority(notice.tone),
  };
}

function createEventLogItem(entry: CareerEventLogEntry): UnifiedFeedItem {
  return {
    id: `log-${entry.id}`,
    type: mapEventLogType(entry.type),
    date: entry.createdAt,
    title: entry.title,
    body: entry.description,
    priority: mapEventLogPriority(entry.type),
  };
}

function createTransferOfferItem(offer: TransferOffer): UnifiedFeedItem {
  const status = getOfferStatusLabel(offer);
  const salary = offer.negotiation.currentTerms.salary.toLocaleString("ko-KR");

  return {
    id: `offer-${offer.id}`,
    type: "transfer_offer",
    date: offer.negotiation.updatedAt || offer.createdAt,
    title: `${offer.clubName} 제안`,
    body: `${status} · ${offer.description} · 연봉 ${salary}만`,
    priority: isActionableOffer(offer) ? "high" : "normal",
    relatedEntityId: offer.id,
    action: isActionableOffer(offer)
      ? {
          type: "open_transfer_offer",
          label: "제안 검토",
        }
      : undefined,
  };
}

function createDevelopmentItem(report: DevelopmentReport): UnifiedFeedItem {
  const growthTotal = report.entries.reduce((total, entry) => total + entry.amount, 0);

  return {
    id: `development-${report.id}`,
    type: "development",
    date: report.createdAt,
    title: report.title,
    body: `${report.entries.length}개 항목 성장 · 총 +${growthTotal.toFixed(2)}`,
    priority: "low",
    relatedEntityId: report.id,
    action: {
      type: "view_development",
      label: "성장 확인",
    },
  };
}

function createMatchItem(result: RecentResult): UnifiedFeedItem {
  const home = getClubName(result.homeClubId);
  const away = getClubName(result.awayClubId);
  const outcome = result.outcome === "win" ? "승리" : result.outcome === "loss" ? "패배" : "무승부";

  return {
    id: `match-${result.id}`,
    type: "match",
    date: result.date,
    title: "경기 결과",
    body: `${home} ${result.homeGoals}-${result.awayGoals} ${away} · ${outcome}`,
    priority: result.outcome === "win" ? "normal" : "low",
    relatedEntityId: result.fixtureId,
    action: {
      type: "view_match",
      label: "결과 보기",
    },
  };
}

export interface CreateUnifiedFeedInput {
  notices: readonly MonthlyNotice[];
  eventLog: readonly CareerEventLogEntry[];
  transferOffers: readonly TransferOffer[];
  seasonYear: number;
  monthlyDevelopmentLog?: readonly DevelopmentReport[];
  recentResults?: readonly RecentResult[];
}

export function createUnifiedFeed(input: CreateUnifiedFeedInput): UnifiedFeedItem[] {
  return [
    ...input.notices.map((notice) => createNoticeItem(notice, input.seasonYear)),
    ...input.eventLog.map(createEventLogItem),
    ...input.transferOffers.map(createTransferOfferItem),
    ...(input.monthlyDevelopmentLog ?? []).map(createDevelopmentItem),
    ...(input.recentResults ?? []).map(createMatchItem),
  ]
    .sort((left, right) => {
      const dateOrder = right.date.localeCompare(left.date);

      if (dateOrder !== 0) {
        return dateOrder;
      }

      return PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority];
    })
    .slice(0, FEED_LIMIT);
}

export function createUnifiedFeedForCareer(career: Pick<
  CareerState,
  "notices" | "eventLog" | "transferOffers" | "season" | "monthlyDevelopmentLog" | "recentResults"
>): UnifiedFeedItem[] {
  return createUnifiedFeed({
    notices: career.notices ?? [],
    eventLog: career.eventLog ?? [],
    transferOffers: career.transferOffers ?? [],
    seasonYear: career.season.year,
    monthlyDevelopmentLog: career.monthlyDevelopmentLog ?? [],
    recentResults: career.recentResults ?? [],
  });
}

export function appendFeedLog(
  career: CareerState,
  entry: CareerEventLogEntry,
  limit = 80,
): CareerState {
  const nextCareer = {
    ...career,
    eventLog: [...(career.eventLog ?? []), entry].slice(-limit),
  };

  return {
    ...nextCareer,
    unifiedFeed: createUnifiedFeedForCareer(nextCareer),
  };
}

export function getFeedItemDate(item: Pick<UnifiedFeedItem, "date">): IsoDateString {
  return item.date;
}
