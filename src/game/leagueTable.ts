import type {
  Club,
  Fixture,
  League,
  LeagueTableRow,
} from "../domain/types";

function createEmptyRow(club: Club): LeagueTableRow {
  return {
    clubId: club.id,
    clubName: club.name,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    position: 0,
  };
}

function applyResult(row: LeagueTableRow, goalsFor: number, goalsAgainst: number, league: League): LeagueTableRow {
  const win = goalsFor > goalsAgainst;
  const draw = goalsFor === goalsAgainst;
  const loss = goalsFor < goalsAgainst;
  const points = win
    ? league.ruleSet.pointsForWin
    : draw
      ? league.ruleSet.pointsForDraw
      : league.ruleSet.pointsForLoss;
  const goalsForTotal = row.goalsFor + goalsFor;
  const goalsAgainstTotal = row.goalsAgainst + goalsAgainst;

  return {
    ...row,
    played: row.played + 1,
    wins: row.wins + (win ? 1 : 0),
    draws: row.draws + (draw ? 1 : 0),
    losses: row.losses + (loss ? 1 : 0),
    goalsFor: goalsForTotal,
    goalsAgainst: goalsAgainstTotal,
    goalDifference: goalsForTotal - goalsAgainstTotal,
    points: row.points + points,
  };
}

export function calculateLeagueTable(league: League, fixtures: readonly Fixture[]): LeagueTableRow[] {
  const rows = new Map(league.clubs.map((club) => [club.id, createEmptyRow(club)]));

  for (const fixture of fixtures) {
    if (
      fixture.leagueId !== league.id ||
      fixture.competitionId !== league.competitionId ||
      fixture.status !== "played" ||
      !fixture.result
    ) {
      continue;
    }

    const home = rows.get(fixture.homeClubId);
    const away = rows.get(fixture.awayClubId);

    if (!home || !away) {
      continue;
    }

    rows.set(fixture.homeClubId, applyResult(home, fixture.result.homeGoals, fixture.result.awayGoals, league));
    rows.set(fixture.awayClubId, applyResult(away, fixture.result.awayGoals, fixture.result.homeGoals, league));
  }

  return [...rows.values()]
    .sort(
      (left, right) =>
        right.points - left.points ||
        right.goalDifference - left.goalDifference ||
        right.goalsFor - left.goalsFor ||
        left.clubName.localeCompare(right.clubName, "ko"),
    )
    .map((row, index) => ({ ...row, position: index + 1 }));
}

export function getClubLeaguePosition(table: readonly LeagueTableRow[], clubId: string): number {
  return table.find((row) => row.clubId === clubId)?.position ?? table.length;
}
