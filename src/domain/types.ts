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
  | "technical.passing"
  | "technical.dribbling"
  | "technical.defending"
  | "technical.firstTouch"
  | "physical.pace"
  | "physical.stamina"
  | "physical.strength"
  | "physical.agility"
  | "mental.decisions"
  | "mental.composure"
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
}

export interface League {
  id: LeagueTier;
  name: string;
  country: string;
  tier: LeagueTier;
  clubs: Club[];
}

export type FixtureStatus = "scheduled" | "played";

export interface FixtureResult {
  homeGoals: number;
  awayGoals: number;
  playerAppeared?: boolean;
  playerMinutes?: number;
  playerRating?: number;
  playerGoals?: number;
  playerAssists?: number;
}

export interface Fixture {
  id: string;
  leagueId: LeagueTier;
  seasonNumber: number;
  round: number;
  month: number;
  homeClubId: string;
  awayClubId: string;
  status: FixtureStatus;
  result?: FixtureResult;
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
  | "season_complete"
  | "season_start";

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

export interface TransferOffer {
  id: string;
  month: number;
  clubId: string;
  clubName: string;
  leagueId: LeagueTier;
  squadRole: SquadRole;
  salary: number;
  description: string;
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
  player: Player;
  leagues: Record<LeagueTier, League>;
  season: Season;
  condition: number;
  fatigue: number;
  form: number;
  reputation: number;
  coachTrust: number;
  salary: number;
  contractYearsLeft: number;
  squadRole: SquadRole;
  injury: InjuryStatus;
  seasonStats: SeasonStats;
  careerHistory: CareerHistoryEntry[];
  transferOffers: TransferOffer[];
  notices: MonthlyNotice[];
  currentEvent?: MonthlyEvent;
  eventLog: CareerEventLogEntry[];
  monthlyDevelopmentLog: DevelopmentReport[];
}
