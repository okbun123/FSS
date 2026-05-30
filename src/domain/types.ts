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
  goals: number;
  assists: number;
  averageRating: number;
  keyMomentsWon: number;
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
  seasonStats: SeasonStats;
  availableWeeklyActions: WeeklyAction[];
}

export interface CareerWeek {
  week: number;
  matches: Match[];
  playerMatch?: Match;
  isSeasonComplete: boolean;
}
