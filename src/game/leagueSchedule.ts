import type { Club, Fixture, League, SeasonMonth, WeekTurn } from "../domain/types";

interface ScheduleOptions {
  seasonNumber?: number;
  totalMonths?: number;
  seasonStartDate?: string;
  roundIntervalDays?: number;
  weekendFixtureSlots?: number;
  kickoffHourUtc?: number;
}

const MONTH_LABELS = [
  "1월",
  "2월",
  "3월",
  "4월",
  "5월",
  "6월",
  "7월",
  "8월",
  "9월",
  "10월",
  "11월",
  "12월",
];

function createFixtureId(
  leagueId: string,
  seasonNumber: number,
  round: number,
  fixtureNumber: number,
  homeClubId: string,
  awayClubId: string,
): string {
  return `${leagueId}-s${seasonNumber}-r${round}-m${fixtureNumber}-${homeClubId}-${awayClubId}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getFirstSaturdayOnOrAfter(year: number, month: number, day: number): Date {
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

  while (date.getUTCDay() !== 6) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return date;
}

function toIsoDate(date: Date): string {
  return date.toISOString();
}

export function getDefaultLeagueSeasonStartDate(year: number): string {
  return toIsoDate(getFirstSaturdayOnOrAfter(year, 2, 24));
}

function getFixtureDate(input: {
  seasonStartDate: Date;
  round: number;
  fixtureNumber: number;
  roundIntervalDays: number;
  weekendFixtureSlots: number;
  kickoffHourUtc: number;
}): Date {
  const roundStart = addDays(input.seasonStartDate, (input.round - 1) * input.roundIntervalDays);
  const dayOffset = Math.floor((input.fixtureNumber - 1) / input.weekendFixtureSlots);
  const slotIndex = (input.fixtureNumber - 1) % input.weekendFixtureSlots;
  const fixtureDate = addDays(roundStart, dayOffset);
  fixtureDate.setUTCHours(input.kickoffHourUtc + slotIndex * 2, 0, 0, 0);
  return fixtureDate;
}

function createFixture(
  league: League,
  seasonNumber: number,
  round: number,
  fixtureNumber: number,
  homeClubId: string,
  awayClubId: string,
  seasonStartDate: Date,
  roundIntervalDays: number,
  weekendFixtureSlots: number,
  kickoffHourUtc: number,
): Fixture {
  const fixtureDate = getFixtureDate({
    seasonStartDate,
    round,
    fixtureNumber,
    roundIntervalDays,
    weekendFixtureSlots,
    kickoffHourUtc,
  });

  return {
    id: createFixtureId(league.id, seasonNumber, round, fixtureNumber, homeClubId, awayClubId),
    leagueId: league.id,
    competitionId: league.competitionId,
    seasonNumber,
    round,
    month: fixtureDate.getUTCMonth() + 1,
    date: toIsoDate(fixtureDate),
    weekNumber: round,
    homeClubId,
    awayClubId,
    status: "scheduled",
  };
}

function createSingleRoundRobin(clubIds: string[]): Array<Array<[string, string]>> {
  const hasBye = clubIds.length % 2 === 1;
  const ids = hasBye ? [...clubIds, "__bye__"] : [...clubIds];
  const fixed = ids[0];
  const rotating = ids.slice(1);
  const rounds: Array<Array<[string, string]>> = [];
  const fixturesPerRound = ids.length / 2;

  for (let roundIndex = 0; roundIndex < ids.length - 1; roundIndex += 1) {
    const roundIds = [fixed, ...rotating];
    const pairings: Array<[string, string]> = [];

    for (let fixtureIndex = 0; fixtureIndex < fixturesPerRound; fixtureIndex += 1) {
      const left = roundIds[fixtureIndex];
      const right = roundIds[roundIds.length - 1 - fixtureIndex];

      if (left !== "__bye__" && right !== "__bye__") {
        pairings.push((roundIndex + fixtureIndex) % 2 === 0 ? [left, right] : [right, left]);
      }
    }

    rounds.push(pairings);

    const last = rotating.pop();
    if (last) {
      rotating.unshift(last);
    }
  }

  return rounds;
}

function repeatRoundRobin(clubs: readonly Club[], cycles: number): Array<Array<[string, string]>> {
  const baseRounds = createSingleRoundRobin(clubs.map((club) => club.id));
  const rounds: Array<Array<[string, string]>> = [];

  for (let cycle = 0; cycle < cycles; cycle += 1) {
    for (const round of baseRounds) {
      rounds.push(
        round.map(([home, away], index) => {
          if (cycle % 2 === 1) {
            return [away, home];
          }
          if (cycle === 2 && index % 2 === 1) {
            return [away, home];
          }
          return [home, away];
        }),
      );
    }
  }

  return rounds;
}

export function generateLeagueFixtures(
  league: League,
  options: ScheduleOptions = {},
): Fixture[] {
  const seasonNumber = options.seasonNumber ?? 1;
  const seasonYear = 2026 + seasonNumber;
  const seasonStartDate = new Date(options.seasonStartDate ?? getDefaultLeagueSeasonStartDate(seasonYear));
  const roundIntervalDays = options.roundIntervalDays ?? 7;
  const weekendFixtureSlots = options.weekendFixtureSlots ?? 4;
  const kickoffHourUtc = options.kickoffHourUtc ?? 11;
  const cycles = league.ruleSet.roundRobinCycles;
  const rounds = repeatRoundRobin(league.clubs, cycles);

  return rounds.flatMap((round, roundIndex) =>
    round.map(([homeClubId, awayClubId], fixtureIndex) =>
      createFixture(
        league,
        seasonNumber,
        roundIndex + 1,
        fixtureIndex + 1,
        homeClubId,
        awayClubId,
        seasonStartDate,
        roundIntervalDays,
        weekendFixtureSlots,
        kickoffHourUtc,
      ),
    ),
  );
}

export function createSeasonMonths(fixtures: readonly Fixture[], totalMonths = 12): SeasonMonth[] {
  return Array.from({ length: totalMonths }, (_, index) => {
    const month = index + 1;

    return {
      month,
      label: MONTH_LABELS[index] ?? `${month}월`,
      fixtureIds: fixtures.filter((fixture) => fixture.month === month).map((fixture) => fixture.id),
    };
  });
}

export function createWeekTurns(fixtures: readonly Fixture[]): WeekTurn[] {
  const weekStarts = new Map<string, Date>();
  const fixtureIdsByWeek = new Map<string, string[]>();

  for (const fixture of fixtures) {
    const fixtureDate = new Date(fixture.date);
    const daysFromMonday = (fixtureDate.getUTCDay() + 6) % 7;
    const weekStart = addDays(fixtureDate, -daysFromMonday);
    const weekKey = toIsoDate(weekStart);
    weekStarts.set(weekKey, weekStart);
    fixtureIdsByWeek.set(weekKey, [
      ...(fixtureIdsByWeek.get(weekKey) ?? []),
      fixture.id,
    ]);
  }

  return [...weekStarts.entries()]
    .sort(([, left], [, right]) => left.getTime() - right.getTime())
    .map(([weekKey, startDate], index) => ({
      id: `week-${index + 1}`,
      seasonNumber: fixtures[0]?.seasonNumber ?? 1,
      weekNumber: index + 1,
      startDate: toIsoDate(startDate),
      endDate: toIsoDate(addDays(startDate, 6)),
      fixtureIds: (fixtureIdsByWeek.get(weekKey) ?? []).sort((leftId, rightId) => {
        const leftFixture = fixtures.find((fixture) => fixture.id === leftId);
        const rightFixture = fixtures.find((fixture) => fixture.id === rightId);
        return (leftFixture?.date ?? "").localeCompare(rightFixture?.date ?? "");
      }),
      status: index === 0 ? "active" : "upcoming",
    }));
}
