import { getClubName } from "../data/clubs";
import type {
  AttributeFocus,
  Attributes,
  CareerEventLogEntry,
  CareerState,
  KeyMoment,
  KeyMomentChoice,
  Match,
  PlayerMatchStats,
  Position,
} from "../domain/types";
import { getCurrentWeek } from "./career";
import { applyMatchGrowth } from "./growth";
import { calculatePlayerRating } from "./rating";
import { createSeededRandom, type RandomSource } from "./random";

export interface SimulateMatchInput {
  seed?: string | number;
  moments?: KeyMoment[];
  choices: Record<string, string>;
  createdAt?: string;
}

export interface SimulateMatchOutput {
  careerState: CareerState;
  match: Match;
}

type StatPatch = Partial<Omit<PlayerMatchStats, "minutesPlayed">>;

interface MomentTemplate {
  type: "attack" | "support" | "defense";
  situation: string;
  choices: KeyMomentChoice[];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function clampRatingEffect(value: number): number {
  return Math.round(value * 100) / 100;
}

function getAttributeValue(attributes: Attributes, focus: AttributeFocus): number {
  const [group, key] = focus.split(".") as [
    keyof Attributes,
    keyof Attributes[keyof Attributes],
  ];
  const attributeGroup = attributes[group] as unknown as Record<string, number>;
  return attributeGroup[key as string];
}

function emptyStats(minutesPlayed: number): PlayerMatchStats {
  return {
    minutesPlayed,
    goals: 0,
    assists: 0,
    shots: 0,
    keyPasses: 0,
    tackles: 0,
    turnovers: 0,
  };
}

function addStats(stats: PlayerMatchStats, patch: StatPatch): PlayerMatchStats {
  return {
    ...stats,
    goals: stats.goals + (patch.goals ?? 0),
    assists: stats.assists + (patch.assists ?? 0),
    shots: stats.shots + (patch.shots ?? 0),
    keyPasses: stats.keyPasses + (patch.keyPasses ?? 0),
    tackles: stats.tackles + (patch.tackles ?? 0),
    turnovers: stats.turnovers + (patch.turnovers ?? 0),
  };
}

function getPositionTemplates(position: Position): MomentTemplate[] {
  const attackingTemplate: MomentTemplate = {
    type: "attack",
    situation: "후반 67분, 동점 상황. 뒷공간 침투 기회가 생겼다.",
    choices: [
      {
        id: "run-behind",
        label: "즉시 침투한다",
        attributeFocus: "technical.finishing",
        risk: "high",
      },
      {
        id: "drop-receive",
        label: "내려와서 공을 받는다",
        attributeFocus: "technical.firstTouch",
        risk: "medium",
      },
      {
        id: "drag-space",
        label: "수비수를 끌고 공간을 만든다",
        attributeFocus: "mental.teamwork",
        risk: "low",
      },
    ],
  };
  const supportTemplate: MomentTemplate = {
    type: "support",
    situation: "전반 34분, 역습이 열렸다. 동료가 측면에서 뛰어 들어간다.",
    choices: [
      {
        id: "thread-pass",
        label: "스루패스를 찔러 넣는다",
        attributeFocus: "technical.passing",
        risk: "high",
      },
      {
        id: "carry-ball",
        label: "직접 운반하며 수비를 흔든다",
        attributeFocus: "technical.dribbling",
        risk: "medium",
      },
      {
        id: "safe-link",
        label: "안전하게 연결하고 위치를 잡는다",
        attributeFocus: "mental.decisions",
        risk: "low",
      },
    ],
  };
  const defensiveTemplate: MomentTemplate = {
    type: "defense",
    situation: "후반 78분, 상대가 박스 근처에서 빠르게 전개한다.",
    choices: [
      {
        id: "hard-tackle",
        label: "강하게 태클을 시도한다",
        attributeFocus: "technical.defending",
        risk: "high",
      },
      {
        id: "delay-runner",
        label: "상대를 늦추며 각도를 줄인다",
        attributeFocus: "mental.decisions",
        risk: "medium",
      },
      {
        id: "cover-space",
        label: "공간을 메우고 동료를 부른다",
        attributeFocus: "mental.teamwork",
        risk: "low",
      },
    ],
  };

  if (position === "CB" || position === "FB" || position === "DM") {
    return [defensiveTemplate, supportTemplate, attackingTemplate];
  }

  if (position === "CM" || position === "AM") {
    return [supportTemplate, attackingTemplate, defensiveTemplate];
  }

  return [attackingTemplate, supportTemplate, defensiveTemplate];
}

function pickMomentMinute(rng: RandomSource, index: number): number {
  const bands = [
    [18, 42],
    [48, 70],
    [71, 88],
  ];
  const [min, max] = bands[index] ?? [25, 85];
  return Math.floor(min + rng() * (max - min + 1));
}

export function generateKeyMoments(career: CareerState, seed: string | number): KeyMoment[] {
  const rng = createSeededRandom(seed);
  const count = 1 + Math.floor(rng() * 3);
  const templates = getPositionTemplates(career.player.position);

  return Array.from({ length: count }, (_, index) => {
    const template = templates[index % templates.length];

    return {
      id: `week-${career.currentWeek}-moment-${index + 1}`,
      minute: pickMomentMinute(rng, index),
      situation: template.situation,
      choices: template.choices,
    };
  });
}

function getMinutesPlayed(career: CareerState): number {
  const stamina = career.player.attributes.physical.stamina;
  return Math.round(
    Math.max(45, Math.min(90, 68 + career.condition * 0.18 - career.fatigue * 0.16 + stamina * 0.08)),
  );
}

function getChance(career: CareerState, choice: KeyMomentChoice): number {
  const riskPenalty = choice.risk === "high" ? 16 : choice.risk === "medium" ? 8 : 2;
  const attribute = getAttributeValue(career.player.attributes, choice.attributeFocus);

  return clamp(
    attribute * 0.52 +
      career.condition * 0.18 +
      career.form * 0.16 -
      career.fatigue * 0.18 -
      riskPenalty +
      22,
    12,
    88,
  );
}

function getSuccessStats(momentType: MomentTemplate["type"], choice: KeyMomentChoice): StatPatch {
  if (momentType === "attack") {
    if (choice.id === "run-behind") {
      return { goals: 1, shots: 1 };
    }
    if (choice.id === "drop-receive") {
      return { shots: 1, keyPasses: 1 };
    }
    return { keyPasses: 1 };
  }

  if (momentType === "support") {
    if (choice.id === "thread-pass") {
      return { assists: 1, keyPasses: 1 };
    }
    if (choice.id === "carry-ball") {
      return { shots: 1, keyPasses: 1 };
    }
    return { keyPasses: 1 };
  }

  if (choice.id === "hard-tackle") {
    return { tackles: 2 };
  }
  return { tackles: 1 };
}

function getFailureStats(choice: KeyMomentChoice): StatPatch {
  return choice.risk === "low" ? {} : { turnovers: 1 };
}

function describeOutcome(choice: KeyMomentChoice, successful: boolean): string {
  if (successful) {
    if (choice.id === "run-behind") {
      return "침투 타이밍이 맞아 결정적인 득점으로 이어졌습니다.";
    }
    if (choice.id === "thread-pass") {
      return "패스가 수비 사이를 갈라 도움으로 연결되었습니다.";
    }
    if (choice.id === "hard-tackle") {
      return "과감한 수비가 성공해 상대 공격을 끊었습니다.";
    }
    return "선택이 통했고 팀 공격 흐름에 좋은 장면을 만들었습니다.";
  }

  return "선택은 좋았지만 실행이 흔들리며 기회를 살리지 못했습니다.";
}

function resolveMoment(
  career: CareerState,
  moment: KeyMoment,
  selectedChoiceId: string,
  rng: RandomSource,
): KeyMoment {
  const choice = moment.choices.find((candidate) => candidate.id === selectedChoiceId) ?? moment.choices[0];
  const templateType =
    getPositionTemplates(career.player.position).find((template) =>
      template.choices.some((candidate) => candidate.id === choice.id),
    )?.type ?? "support";
  const chance = getChance(career, choice);
  const roll = rng() * 100;
  const successful = roll <= chance;
  const stats = successful ? getSuccessStats(templateType, choice) : getFailureStats(choice);
  const ratingModifier = successful
    ? choice.risk === "high"
      ? 0.45
      : choice.risk === "medium"
        ? 0.3
        : 0.18
    : choice.risk === "high"
      ? -0.35
      : -0.18;

  return {
    ...moment,
    selectedChoiceId: choice.id,
    outcome: {
      successful,
      chance: Math.round(chance),
      roll: Math.round(roll),
      description: describeOutcome(choice, successful),
      ratingModifier: clampRatingEffect(ratingModifier),
      stats,
    },
  };
}

function createBaseStats(career: CareerState, minutesPlayed: number): PlayerMatchStats {
  const stats = emptyStats(minutesPlayed);

  if (career.player.position === "CB" || career.player.position === "FB" || career.player.position === "DM") {
    return {
      ...stats,
      tackles: 1 + Math.floor(career.player.attributes.technical.defending / 35),
      keyPasses: career.player.position === "DM" ? 1 : 0,
    };
  }

  if (career.player.position === "CM" || career.player.position === "AM") {
    return {
      ...stats,
      shots: career.player.position === "AM" ? 1 : 0,
      keyPasses: 1 + Math.floor(career.player.attributes.technical.passing / 40),
      tackles: 1,
    };
  }

  return {
    ...stats,
    shots: 1 + Math.floor(career.player.attributes.technical.finishing / 45),
    keyPasses: career.player.position === "ST" ? 0 : 1,
  };
}

function calculateScore(
  career: CareerState,
  match: Match,
  stats: PlayerMatchStats,
  rng: RandomSource,
): { homeGoals: number; awayGoals: number } {
  const homeClub = career.league.clubs.find((club) => club.id === match.homeClubId);
  const awayClub = career.league.clubs.find((club) => club.id === match.awayClubId);
  const homeStrength = homeClub?.strength ?? 60;
  const awayStrength = awayClub?.strength ?? 60;
  const playerIsHome = match.homeClubId === career.player.clubId;
  const playerImpact = stats.goals + stats.assists * 0.7 + stats.keyPasses * 0.08 + stats.tackles * 0.04;
  const homeExpected =
    0.7 + homeStrength / 45 + (playerIsHome ? playerImpact : 0) + rng() * 0.9;
  const awayExpected =
    0.65 + awayStrength / 47 + (!playerIsHome ? playerImpact : 0) + rng() * 0.9;

  return {
    homeGoals: Math.max(0, Math.min(5, Math.floor(homeExpected))),
    awayGoals: Math.max(0, Math.min(5, Math.floor(awayExpected))),
  };
}

function updateAverageRating(previousAverage: number, previousApps: number, rating: number): number {
  return Math.round(((previousAverage * previousApps + rating) / (previousApps + 1)) * 100) / 100;
}

function createMatchEvent(career: CareerState, match: Match, rating: number, createdAt?: string): CareerEventLogEntry {
  return {
    id: `week-${career.currentWeek}-match-${match.id}`,
    week: career.currentWeek,
    title: "경기 완료",
    description: `${getClubName(match.homeClubId)} ${match.result?.homeGoals ?? 0}-${match.result?.awayGoals ?? 0} ${getClubName(match.awayClubId)}, 평점 ${rating.toFixed(1)}`,
    createdAt: createdAt ?? "1970-01-01T00:00:00.000Z",
  };
}

function updateCareerAfterMatch(
  career: CareerState,
  match: Match,
  stats: PlayerMatchStats,
  rating: number,
  successfulMoments: number,
  createdAt?: string,
): CareerState {
  const previousApps = career.seasonStats.appearances;
  const nextSeasonStats = {
    appearances: previousApps + 1,
    minutesPlayed: (career.seasonStats.minutesPlayed ?? 0) + stats.minutesPlayed,
    goals: career.seasonStats.goals + stats.goals,
    assists: career.seasonStats.assists + stats.assists,
    shots: (career.seasonStats.shots ?? 0) + stats.shots,
    keyPasses: (career.seasonStats.keyPasses ?? 0) + stats.keyPasses,
    tackles: (career.seasonStats.tackles ?? 0) + stats.tackles,
    turnovers: (career.seasonStats.turnovers ?? 0) + stats.turnovers,
    averageRating: updateAverageRating(career.seasonStats.averageRating, previousApps, rating),
    keyMomentsWon: career.seasonStats.keyMomentsWon + successfulMoments,
  };
  const nextMatches = career.season.matches.map((scheduledMatch) =>
    scheduledMatch.id === match.id ? match : scheduledMatch,
  );

  const updatedCareer: CareerState = {
    ...career,
    season: {
      ...career.season,
      matches: nextMatches,
    },
    seasonStats: nextSeasonStats,
    form: clamp(career.form + (rating >= 7 ? 4 : rating >= 6 ? 1 : -3)),
    condition: clamp(career.condition - 8),
    fatigue: clamp(career.fatigue + 12),
    coachTrust: clamp(career.coachTrust + (rating >= 7 ? 4 : rating >= 6 ? 1 : -2)),
    fanSupport: clamp(career.fanSupport + stats.goals * 3 + stats.assists * 2 + (rating >= 7 ? 2 : 0)),
    eventLog: [...career.eventLog, createMatchEvent(career, match, rating, createdAt)].slice(-30),
  };

  return applyMatchGrowth(updatedCareer, {
    stats,
    rating,
    createdAt,
  });
}

export function simulateCurrentMatch(
  career: CareerState,
  input: SimulateMatchInput,
): SimulateMatchOutput {
  const playerMatch = getCurrentWeek(career).playerMatch;

  if (!playerMatch) {
    throw new Error("No scheduled player match for the current week.");
  }

  if (playerMatch.status === "played") {
    throw new Error("Current match has already been played.");
  }

  const seed = input.seed ?? `${career.player.id}-${career.currentWeek}-${playerMatch.id}`;
  const rng = createSeededRandom(seed);
  const moments = input.moments ?? generateKeyMoments(career, seed);
  const minutesPlayed = getMinutesPlayed(career);
  const resolvedMoments = moments.map((moment) =>
    resolveMoment(career, moment, input.choices[moment.id] ?? moment.choices[0].id, rng),
  );
  const momentStats = resolvedMoments.reduce(
    (stats, moment) => addStats(stats, moment.outcome?.stats ?? {}),
    createBaseStats(career, minutesPlayed),
  );
  const score = calculateScore(career, playerMatch, momentStats, rng);
  const playerIsHome = playerMatch.homeClubId === career.player.clubId;
  const teamGoalsFor = playerIsHome ? score.homeGoals : score.awayGoals;
  const teamGoalsAgainst = playerIsHome ? score.awayGoals : score.homeGoals;
  const ratingResult = calculatePlayerRating({
    stats: momentStats,
    keyMoments: resolvedMoments,
    teamGoalsFor,
    teamGoalsAgainst,
    condition: career.condition,
    fatigue: career.fatigue,
    form: career.form,
  });
  const playedMatch: Match = {
    ...playerMatch,
    status: "played",
    result: {
      ...score,
      playerMinutes: minutesPlayed,
      playerRating: ratingResult.rating,
      playerStats: momentStats,
      ratingModifiers: ratingResult.modifiers,
      keyMoments: resolvedMoments,
    },
  };
  const successfulMoments = resolvedMoments.filter((moment) => moment.outcome?.successful).length;
  const careerState = updateCareerAfterMatch(
    career,
    playedMatch,
    momentStats,
    ratingResult.rating,
    successfulMoments,
    input.createdAt,
  );

  return {
    careerState,
    match: playedMatch,
  };
}
