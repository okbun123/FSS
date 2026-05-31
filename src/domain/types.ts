export type Position = "ST" | "LW" | "RW" | "AM" | "CM" | "DM" | "FB" | "CB";

export type PreferredFoot = "right" | "left" | "both";

export type PlayStyle =
  | "poacher"
  | "targetForward"
  | "insideForward"
  | "wideCreator"
  | "playmaker"
  | "shadowStriker"
  | "boxToBox"
  | "deepPlaymaker"
  | "ballWinner"
  | "holdingMidfielder"
  | "overlapper"
  | "invertedFullback"
  | "stopper"
  | "ballPlayingDefender";

export type Personality =
  | "diligent"
  | "ambitious"
  | "star"
  | "teamPlayer"
  | "maverick";

export type SquadRole = "prospect" | "rotation" | "regular" | "keyPlayer";

export interface TechnicalAttributes {
  finishing: number;
  passing: number;
  dribbling: number;
  defending: number;
  firstTouch: number;
}

export interface PhysicalAttributes {
  pace: number;
  stamina: number;
  strength: number;
  agility: number;
}

export interface MentalAttributes {
  decisions: number;
  composure: number;
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

export interface Player {
  id: string;
  name: string;
  nationality: string;
  age: number;
  preferredFoot: PreferredFoot;
  position: Position;
  playStyle: PlayStyle;
  personality: Personality;
  clubId: string;
  potential: number;
  attributes: Attributes;
}

export interface Club {
  id: string;
  name: string;
  city: string;
  strength: number;
  reputation: number;
}

export interface League {
  id: string;
  name: string;
  country: string;
  clubs: Club[];
  seasonWeeks: number;
}

export type MatchStatus = "scheduled" | "played";

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  playerRating?: number;
  playerMinutes?: number;
  playerStats?: PlayerMatchStats;
  ratingModifiers?: RatingModifier[];
  keyMoments?: KeyMoment[];
}

export type MatchEventType =
  | "chance"
  | "buildUp"
  | "defensiveAction"
  | "pressing"
  | "setPiece";

export interface MatchEventChoice {
  id: string;
  label: string;
  attributeFocus: keyof TechnicalAttributes | keyof PhysicalAttributes | keyof MentalAttributes;
  risk: "low" | "medium" | "high";
}

export interface MatchEvent {
  id: string;
  matchId: string;
  minute: number;
  type: MatchEventType;
  description: string;
  choices: MatchEventChoice[];
  selectedChoiceId?: string;
  successful?: boolean;
}

export interface Match {
  id: string;
  week: number;
  homeClubId: string;
  awayClubId: string;
  status: MatchStatus;
  events: MatchEvent[];
  result?: MatchResult;
}

export interface PlayerMatchStats {
  minutesPlayed: number;
  goals: number;
  assists: number;
  shots: number;
  keyPasses: number;
  tackles: number;
  turnovers: number;
}

export interface RatingModifier {
  label: string;
  value: number;
  kind: "positive" | "negative" | "neutral";
}

export interface KeyMomentChoice {
  id: string;
  label: string;
  attributeFocus: AttributeFocus;
  risk: "low" | "medium" | "high";
}

export interface KeyMomentOutcome {
  successful: boolean;
  chance: number;
  roll: number;
  description: string;
  ratingModifier: number;
  stats: Partial<Omit<PlayerMatchStats, "minutesPlayed">>;
}

export interface KeyMoment {
  id: string;
  minute: number;
  situation: string;
  choices: KeyMomentChoice[];
  selectedChoiceId?: string;
  outcome?: KeyMomentOutcome;
}

export type WeeklyActionType =
  | "teamTraining"
  | "individualTraining"
  | "recovery"
  | "mediaActivity"
  | "relationship";

export interface WeeklyAction {
  type: WeeklyActionType;
  label: string;
  description: string;
  fatigueChange: number;
  conditionChange: number;
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
  | "mental.teamwork";

export interface CareerEventLogEntry {
  id: string;
  week: number;
  title: string;
  description: string;
  createdAt: string;
}

export type DevelopmentSource = "weeklyTraining" | "match";

export interface AttributeGrowthEntry {
  attribute: AttributeFocus;
  label: string;
  before: number;
  after: number;
  amount: number;
}

export interface DevelopmentReport {
  id: string;
  week: number;
  source: DevelopmentSource;
  title: string;
  entries: AttributeGrowthEntry[];
  createdAt: string;
}

export interface SeasonBaseline {
  seasonNumber: number;
  clubId: string;
  clubName: string;
  coachTrust: number;
  fanSupport: number;
  reputation: number;
  attributes: Attributes;
}

export interface SeasonSummary {
  seasonNumber: number;
  clubId: string;
  clubName: string;
  leaguePosition: number;
  appearances: number;
  goals: number;
  assists: number;
  averageRating: number;
  coachTrustChange: number;
  fanSupportChange: number;
  reputationChange: number;
  attributeGrowthSummary: AttributeGrowthEntry[];
}

export interface CareerHistoryEntry extends SeasonSummary {
  id: string;
  completedAt: string;
}

export interface Season {
  id: string;
  number: number;
  leagueId: string;
  currentWeek: number;
  totalWeeks: number;
  matches: Match[];
  isComplete: boolean;
}

export interface SeasonStats {
  appearances: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  shots: number;
  keyPasses: number;
  tackles: number;
  turnovers: number;
  averageRating: number;
  keyMomentsWon: number;
}

export type ContractOfferType =
  | "stay"
  | "strongerLowerPlayingTime"
  | "weakerHigherPlayingTime";

export interface ContractOffer {
  id: string;
  type: ContractOfferType;
  clubId: string;
  clubName: string;
  salary: number;
  contractYears: number;
  squadRole: SquadRole;
  fanSupportChange: number;
  description: string;
}

export interface CareerState {
  saveVersion: number;
  player: Player;
  league: League;
  season: Season;
  currentWeek: number;
  condition: number;
  fatigue: number;
  form: number;
  coachTrust: number;
  fanSupport: number;
  reputation: number;
  tacticalFit: number;
  salary: number;
  contractYearsLeft: number;
  squadRole: SquadRole;
  weeklyActionCompleted: boolean;
  seasonStats: SeasonStats;
  availableWeeklyActions: WeeklyAction[];
  eventLog: CareerEventLogEntry[];
  developmentLog: DevelopmentReport[];
  seasonBaseline: SeasonBaseline;
  careerHistory: CareerHistoryEntry[];
  seasonOffers: ContractOffer[];
  acceptedContractOfferId?: string;
  rejectedContractOfferIds: string[];
}

export interface CareerWeek {
  week: number;
  matches: Match[];
  playerMatch?: Match;
  isSeasonComplete: boolean;
}
