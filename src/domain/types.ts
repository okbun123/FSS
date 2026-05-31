export type Position = "ST" | "LW" | "RW" | "AM" | "CM" | "DM" | "FB" | "CB";

export type Footedness = "left" | "right" | "both";

export type Personality =
  | "diligent"
  | "ambitious"
  | "star"
  | "teamPlayer"
  | "maverick";

export type SquadRole = "prospect" | "rotation" | "regular" | "keyPlayer";

export type LeagueTier = "k1_fictional" | "k2_fictional";

export type IsoDateString = string;

export type CompetitionType = "league" | "cup" | "playoff";

export interface GameDate {
  iso: IsoDateString;
  seasonNumber: number;
  year: number;
  month: number;
  day: number;
  weekNumber: number;
}

export type WeekTurnStatus = "upcoming" | "active" | "completed";

export interface WeekTurn {
  id: string;
  seasonNumber: number;
  weekNumber: number;
  startDate: IsoDateString;
  endDate: IsoDateString;
  fixtureIds: string[];
  status: WeekTurnStatus;
}

export type MatchPhase =
  | "PRE_MATCH"
  | "FIRST_HALF"
  | "HALF_TIME"
  | "SECOND_HALF"
  | "FULL_TIME"
  | "EXTRA_TIME_FIRST_HALF"
  | "EXTRA_TIME_HALF_TIME"
  | "EXTRA_TIME_SECOND_HALF"
  | "EXTRA_TIME_FULL_TIME"
  | "PENALTY_SHOOTOUT"
  | "FINISHED";

export type MatchEventType =
  | "kickoff"
  | "goal"
  | "ownGoal"
  | "assist"
  | "substitution"
  | "substitutionIn"
  | "substitutionOut"
  | "yellowCard"
  | "secondYellowRed"
  | "straightRed"
  | "redCard"
  | "injury"
  | "penaltyAwarded"
  | "penaltyScored"
  | "penaltyMissed"
  | "halfTime"
  | "extraTimeStart"
  | "extraTimeEnd"
  | "shootoutKick"
  | "fullTime";

export type MatchPlayerStatus =
  | "available"
  | "onPitch"
  | "substituted"
  | "sentOff"
  | "injured";

export interface MatchPlayer {
  playerId: string;
  name: string;
  position: Position;
  squadNumber?: number;
  isUserPlayer?: boolean;
  condition: number;
  rating?: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCard: boolean;
  injured?: boolean;
  status?: MatchPlayerStatus;
  minutesPlayed: number;
}

export interface MatchLineup {
  clubId: string;
  formation: string;
  starters: MatchPlayer[];
  substitutes: MatchPlayer[];
}

export interface MatchEvent {
  id: string;
  matchId: string;
  minute: number;
  stoppageMinute?: number;
  phase: MatchPhase;
  type: MatchEventType;
  clubId?: string;
  playerId?: string;
  relatedPlayerId?: string;
  playerName?: string;
  relatedPlayerName?: string;
  teamName?: string;
  scoreAfter?: {
    homeGoals: number;
    awayGoals: number;
  };
  shootoutScoreAfter?: {
    homeGoals: number;
    awayGoals: number;
  };
  shootoutKickResult?: "scored" | "missed";
  description: string;
  pausesSimulation: boolean;
}

export type MatchStateStatus = "notStarted" | "inProgress" | "paused" | "completed";

export interface MatchState {
  status: MatchStateStatus;
  phase: MatchPhase;
  minute: number;
  homeGoals: number;
  awayGoals: number;
  isPaused: boolean;
  pauseReason?: MatchEventType;
  lastEventId?: string;
  nextEventIndex: number;
  requiresExtraTime?: boolean;
  requiresPenaltyShootout?: boolean;
  winnerClubId?: string;
  aggregateHomeGoalsBeforeMatch?: number;
  aggregateAwayGoalsBeforeMatch?: number;
  shootout?: PenaltyShootoutState;
}

export interface PenaltyShootoutKick {
  id: string;
  round: number;
  kickIndex: number;
  team: "home" | "away";
  clubId: string;
  playerId?: string;
  playerName?: string;
  outcome: "scored" | "missed";
  scoreAfter: {
    homeGoals: number;
    awayGoals: number;
  };
  decisive?: boolean;
}

export interface PenaltyShootoutState {
  status: "notStarted" | "inProgress" | "completed";
  currentKickIndex: number;
  homeGoals: number;
  awayGoals: number;
  kicks: PenaltyShootoutKick[];
  winnerClubId?: string;
}

export interface Match {
  id: string;
  fixtureId: string;
  competitionId: string;
  date: IsoDateString;
  homeClubId: string;
  awayClubId: string;
  isKnockout?: boolean;
  state: MatchState;
  lineups: {
    home: MatchLineup;
    away: MatchLineup;
  };
  events: MatchEvent[];
  scriptedEvents?: MatchEvent[];
}

export interface Competition {
  id: string;
  name: string;
  type: CompetitionType;
  country: string;
  seasonNumber: number;
  leagueIds: LeagueTier[];
  fixtureIds: string[];
}

export type PlayoffRoundStatus = "pending" | "scheduled" | "completed";
export type PlayoffTieFormat = "singleLeg" | "twoLegged";
export type PlayoffStage =
  | "promotionPlayoffSemifinals"
  | "promotionPlayoffFinal"
  | "promotionRelegationPlayoff";

export interface PlayoffFixtureMetadata {
  bracketId: string;
  roundId: string;
  tieId: string;
  stage: PlayoffStage;
  tieFormat: PlayoffTieFormat;
  leg: number;
  totalLegs: number;
  higherSeedClubId?: string;
  drawAdvantageClubId?: string;
}

export interface PlayoffTie {
  id: string;
  roundId: string;
  name: string;
  stage: PlayoffStage;
  fixtureIds: string[];
  clubIds: string[];
  tieFormat: PlayoffTieFormat;
  higherSeedClubId?: string;
  drawAdvantageClubId?: string;
  winnerClubId?: string;
  loserClubId?: string;
  status: PlayoffRoundStatus;
}

export interface PlayoffBracket {
  id: string;
  competitionId: string;
  seasonNumber: number;
  name: string;
  entrantClubIds: string[];
  rounds: Array<{
    id: string;
    name: string;
    fixtureIds: string[];
    winnerClubId?: string;
    status: PlayoffRoundStatus;
  }>;
  ties?: PlayoffTie[];
  winnerClubId?: string;
}

export interface LeaguePlayoffConfig {
  id: string;
  stage: PlayoffStage;
  entrantPositionStart?: number;
  entrantPositionEnd?: number;
  entrantPositionsFromBottom?: number[];
  bracketType?: "seededSemifinals" | "finalOnly";
  tieFormat: PlayoffTieFormat;
  higherSeedHosts?: boolean;
  drawAdvantage?: "higherSeed" | "none";
}

export interface LeagueTransitionSpecialCase {
  id: "militaryCivicTransition";
  clubIds: string[];
  ifBottomSkipsRelegationPlayoff: boolean;
  bottomClubDirectRelegation: boolean;
}

export interface LeagueRuleSet {
  id: string;
  seasonStartYear: number;
  leagueId: LeagueTier;
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  tableTiebreakers: Array<"points" | "goalDifference" | "goalsFor" | "wins" | "headToHead" | "clubName">;
  roundRobinCycles: number;
  directPromotionSlots: number;
  directRelegationSlots: number;
  promotionPlayoffConfig?: LeaguePlayoffConfig;
  relegationPlayoffConfig?: LeaguePlayoffConfig;
  transitionSpecialCase?: LeagueTransitionSpecialCase;
  teamCountTargetByLeague: Partial<Record<LeagueTier, number>>;
}

export interface PromotionRelegationResult {
  seasonNumber: number;
  fromLeagueId: LeagueTier;
  toLeagueId: LeagueTier;
  promotedClubIds: string[];
  relegatedClubIds: string[];
  playoffBracket?: PlayoffBracket;
  notes: string[];
}

export interface PromotionRelegationPlayoffResult {
  id: string;
  stage: PlayoffStage;
  name: string;
  fixtureIds: string[];
  clubIds: string[];
  winnerClubId?: string;
  loserClubId?: string;
  decidedBy?: FixtureResult["decidedBy"] | "higherSeed";
}

export interface ClubSeasonRecord {
  seasonNumber: number;
  leagueId: LeagueTier;
  leaguePosition: number;
  predictedFinish?: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  reputation: number;
  budgetLevel: number;
  youthOpportunity: number;
  squadStrength: number;
  leagueMovement?: "promoted" | "relegated" | "stayed";
  cupResult?: string;
  continentalResult?: string;
}

export type ClubEvolutionMetric =
  | "reputation"
  | "budgetLevel"
  | "youthOpportunity"
  | "squadStrength";

export type ClubEvolutionValues = Pick<Club, ClubEvolutionMetric>;

export interface ClubEvolutionCappedChange {
  metric: ClubEvolutionMetric;
  requestedDelta: number;
  appliedDelta: number;
  oldValue: number;
  newValue: number;
  min: number;
  max: number;
  maxIncrease: number;
  maxDecrease: number;
}

export interface ClubEvolutionResult {
  clubId: string;
  seasonNumber: number;
  oldValues: ClubEvolutionValues;
  newValues: ClubEvolutionValues;
  reasons: string[];
  cappedChanges: ClubEvolutionCappedChange[];
}

export interface TeamPopupData {
  club: Club;
  league: League;
  recentResults: RecentResult[];
  seasonRecord?: ClubSeasonRecord;
  nextFixture?: Fixture;
}

export type UnifiedFeedItemType =
  | "urgent"
  | "log"
  | "transfer_offer"
  | "contract_offer"
  | "injury"
  | "match"
  | "development"
  | "league"
  | "system";

export type UnifiedFeedPriority = "low" | "normal" | "high" | "critical";

export type UnifiedFeedActionType =
  | "open_transfer_offer"
  | "review_contract"
  | "view_match"
  | "view_development";

export interface UnifiedFeedAction {
  type: UnifiedFeedActionType;
  label: string;
}

export interface UnifiedFeedItem {
  id: string;
  type: UnifiedFeedItemType;
  date: IsoDateString;
  title: string;
  body: string;
  priority: UnifiedFeedPriority;
  relatedEntityId?: string;
  action?: UnifiedFeedAction;
}

export interface TechnicalAttributes {
  finishing: number;
  shooting?: number;
  passing: number;
  dribbling: number;
  defending: number;
  firstTouch: number;
  crossing?: number;
  tackling?: number;
  marking?: number;
  heading?: number;
}

export interface PhysicalAttributes {
  pace: number;
  speed?: number;
  acceleration?: number;
  stamina: number;
  strength: number;
  agility: number;
}

export interface MentalAttributes {
  decisions: number;
  composure: number;
  concentration?: number;
  workRate: number;
  teamwork: number;
}

export interface CareerAttributes {
  professionalism: number;
  adaptability: number;
  leadership: number;
  marketability: number;
}

export interface Attributes {
  technical: TechnicalAttributes;
  physical: PhysicalAttributes;
  mental: MentalAttributes;
  career: CareerAttributes;
}

export type AttributeFocus =
  | "technical.finishing"
  | "technical.shooting"
  | "technical.passing"
  | "technical.dribbling"
  | "technical.defending"
  | "technical.firstTouch"
  | "technical.crossing"
  | "technical.tackling"
  | "technical.marking"
  | "technical.heading"
  | "physical.pace"
  | "physical.speed"
  | "physical.acceleration"
  | "physical.stamina"
  | "physical.strength"
  | "physical.agility"
  | "mental.decisions"
  | "mental.composure"
  | "mental.concentration"
  | "mental.workRate"
  | "mental.teamwork"
  | "career.professionalism"
  | "career.adaptability"
  | "career.leadership"
  | "career.marketability";

export interface PositionRecommendation {
  position: Position;
  fitScore: number;
  isRecommended: boolean;
  reason: string;
  keyStrengths: string[];
  keyWeaknesses: string[];
  /** OVR preview for this position. */
  overall: number;
  /** @deprecated Use reason. */
  explanationKo: string;
}

export interface Player {
  id: string;
  name: string;
  nationality: string;
  age: number;
  selectedPosition: Position;
  recommendedPositions: PositionRecommendation[];
  attributes: Attributes;
  leftFoot: number;
  rightFoot: number;
  dominantFoot: Footedness;
  OVR: number;
  potential: number;
  form: number;
  condition: number;
  fatigue: number;
  reputation: number;
  coachTrust: number;
  marketValue: number;
  clubId: string;
  personality: Personality;
  /** @deprecated Use selectedPosition. Kept only for older internal code and saves. */
  position: Position;
}

export interface ClubTrainingFacilities {
  technicalTraining: number;
  physicalTraining: number;
  tacticalTraining: number;
  mentalTraining: number;
  youthDevelopment: number;
  medicalSupport: number;
}

/** @deprecated Use ClubTrainingFacilities. */
export type TrainingFacilities = ClubTrainingFacilities;

export interface SquadSummary {
  averageOvr: number;
  averageAge: number;
  depth: number;
  style: string;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  city: string;
  leagueId: LeagueTier;
  reputation: number;
  trainingFacilities: ClubTrainingFacilities;
  squadStrength: number;
  budgetLevel: number;
  playStyle: string;
  youthOpportunity: number;
  transferPolicy: string;
  tier: LeagueTier;
  /** @deprecated Use squadStrength. */
  strength: number;
  /** @deprecated Use squadStrength. */
  squadLevel: number;
  /** Text-only color label, not a logo or asset reference. */
  primaryColor: string;
  /** @deprecated Use primaryColor for display text. */
  secondaryColor: string;
  squadSummary: SquadSummary;
  seasonRecords: ClubSeasonRecord[];
  lastEvolution?: ClubEvolutionResult;
}

export interface League {
  id: LeagueTier;
  name: string;
  country: string;
  tier: LeagueTier;
  level: number;
  competitionId: string;
  ruleSet: LeagueRuleSet;
  seasonStartMonth: number;
  seasonEndMonth: number;
  clubs: Club[];
}

export type FixtureStatus = "scheduled" | "inProgress" | "played" | "postponed";

export interface FixtureResult {
  homeGoals: number;
  awayGoals: number;
  winnerClubId?: string;
  decidedBy?: "normalTime" | "extraTime" | "penalties";
  homePenaltyGoals?: number;
  awayPenaltyGoals?: number;
  playerAppeared?: boolean;
  playerMinutes?: number;
  playerRating?: number;
  playerGoals?: number;
  playerAssists?: number;
}

export interface Fixture {
  id: string;
  leagueId: LeagueTier;
  competitionId: string;
  seasonNumber: number;
  round: number;
  month: number;
  date: IsoDateString;
  weekNumber: number;
  homeClubId: string;
  awayClubId: string;
  status: FixtureStatus;
  matchId?: string;
  result?: FixtureResult;
  playoff?: PlayoffFixtureMetadata;
}

export interface SeasonMonth {
  month: number;
  label: string;
  fixtureIds: string[];
}

export interface LeagueTableRow {
  clubId: string;
  clubName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  position: number;
}

export interface PromotionRelegationStatus {
  seasonNumber?: number;
  seasonStartYear?: number;
  ruleSetIds?: Partial<Record<LeagueTier, string>>;
  stage?: PlayoffStage | "resolved";
  isResolved?: boolean;
  directPromotionClubIds?: string[];
  directRelegationClubIds?: string[];
  promotionPlayoffClubIds?: string[];
  relegationPlayoffClubIds?: string[];
  promotedClubIds?: string[];
  relegatedClubIds?: string[];
  playoffFixtureIds?: string[];
  playoffResults?: PromotionRelegationPlayoffResult[];
  playoffBracket?: PlayoffBracket;
  automaticRelegationClubId?: string;
  playoffClubId?: string;
  automaticPromotionClubId?: string;
  promotionPlayoffClubId?: string;
  note: string;
}

export interface Season {
  id: string;
  number: number;
  year: number;
  currentMonth: number;
  totalMonths: number;
  months: SeasonMonth[];
  fixtures: Fixture[];
  tables: Record<LeagueTier, LeagueTableRow[]>;
  isComplete: boolean;
  promotionRelegation?: PromotionRelegationStatus;
}

export type MonthlyEventType =
  | "coach_feedback"
  | "training_report"
  | "media_attention"
  | "transfer_rumor"
  | "rival_competition"
  | "injury_warning"
  | "first_team_chance"
  | "contract_discussion"
  | "fan_reaction"
  | "tactical_role_change";

export interface MonthlyEventEffect {
  coachTrust?: number;
  reputation?: number;
  form?: number;
  condition?: number;
  fatigue?: number;
  professionalism?: number;
  adaptability?: number;
  marketability?: number;
  injuryRisk?: number;
}

export interface MonthlyEventChoice {
  id: string;
  label: string;
  description: string;
  effect: MonthlyEventEffect;
}

export interface MonthlyEvent {
  id: string;
  month: number;
  type: MonthlyEventType;
  title: string;
  description: string;
  choices: MonthlyEventChoice[];
  selectedChoiceId?: string;
  resolvedDescription?: string;
}

export interface MonthlyNotice {
  id: string;
  month: number;
  title: string;
  description: string;
  tone: "info" | "success" | "warning";
}

export type CareerEventLogType =
  | MonthlyEventType
  | "career_start"
  | "monthly_summary"
  | "weekly_summary"
  | "season_complete"
  | "season_start"
  | "transfer_offer"
  | "transfer_negotiation"
  | "transfer_completed";

export interface CareerEventLogEntry {
  id: string;
  seasonNumber: number;
  month: number;
  type: CareerEventLogType;
  title: string;
  description: string;
  createdAt: string;
}

export type InjurySeverity = "healthy" | "minor" | "major";

export interface InjuryStatus {
  severity: InjurySeverity;
  monthsRemaining: number;
  description?: string;
}

export type DevelopmentSource = "clubTraining" | "match" | "event";

export interface AttributeGrowthEntry {
  attribute: AttributeFocus;
  label: string;
  before: number;
  after: number;
  amount: number;
}

export interface DevelopmentReport {
  id: string;
  month: number;
  source: DevelopmentSource;
  title: string;
  entries: AttributeGrowthEntry[];
  createdAt: string;
}

export interface SeasonStats {
  appearances: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  averageRating: number;
}

export interface ContractTerms {
  salary: number;
  contractYears: number;
  signingBonus: number;
  squadRole: SquadRole;
  promisedPosition?: Position;
  releaseClause?: number;
  appearanceBonus?: number;
  goalBonus?: number;
}

export type NegotiationStatus = "open" | "countered" | "accepted" | "rejected" | "expired" | "withdrawn";

export interface NegotiationState {
  status: NegotiationStatus;
  round: number;
  maxRounds: number;
  currentTerms: ContractTerms;
  playerCounterTerms?: ContractTerms;
  lastResponse?: "waiting" | "accepted" | "rejected" | "improved" | "final";
  updatedAt: IsoDateString;
}

export interface TransferOffer {
  id: string;
  month: number;
  clubId: string;
  clubName: string;
  leagueId: LeagueTier;
  squadRole: SquadRole;
  salary: number;
  transferFee?: number;
  createdAt: IsoDateString;
  expiresAt: IsoDateString;
  contractTerms: ContractTerms;
  negotiation: NegotiationState;
  description: string;
}

export type MatchOutcome = "win" | "draw" | "loss";

export interface PlayerAppearanceLog {
  id: string;
  fixtureId: string;
  matchId?: string;
  date: IsoDateString;
  seasonNumber: number;
  competitionId: string;
  clubId: string;
  opponentClubId: string;
  wasHome: boolean;
  position: Position;
  minutes: number;
  goals: number;
  assists: number;
  rating: number;
  outcome: MatchOutcome;
}

export interface RecentResult {
  id: string;
  fixtureId: string;
  matchId?: string;
  date: IsoDateString;
  competitionId: string;
  homeClubId: string;
  awayClubId: string;
  homeGoals: number;
  awayGoals: number;
  playerClubId?: string;
  outcome?: MatchOutcome;
}

export interface CareerHistoryEntry {
  id: string;
  seasonNumber: number;
  year: number;
  clubId: string;
  clubName: string;
  leagueName: string;
  appearances: number;
  goals: number;
  assists: number;
  averageRating: number;
  leaguePosition: number;
  achievement?: string;
}

export interface CareerState {
  saveVersion: number;
  currentDate: IsoDateString;
  currentWeekStartDate: IsoDateString;
  activeMatchId?: string;
  player: Player;
  leagues: Record<LeagueTier, League>;
  competitions: Record<string, Competition>;
  clubs: Record<string, Club>;
  fixtures: Fixture[];
  weekTurns: WeekTurn[];
  matches: Record<string, Match>;
  season: Season;
  condition: number;
  fatigue: number;
  form: number;
  reputation: number;
  fanSupport: number;
  coachTrust: number;
  salary: number;
  contractYearsLeft: number;
  squadRole: SquadRole;
  injury: InjuryStatus;
  seasonStats: SeasonStats;
  careerHistory: CareerHistoryEntry[];
  unifiedFeed: UnifiedFeedItem[];
  transferOffers: TransferOffer[];
  playerAppearanceLogs: PlayerAppearanceLog[];
  recentResults: RecentResult[];
  notices: MonthlyNotice[];
  currentEvent?: MonthlyEvent;
  eventLog: CareerEventLogEntry[];
  monthlyDevelopmentLog: DevelopmentReport[];
}
