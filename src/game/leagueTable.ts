import type {
  Club,
  Fixture,
  League,
  LeagueTableRow,
  PromotionRelegationStatus,
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

function applyResult(row: LeagueTableRow, goalsFor: number, goalsAgainst: number): LeagueTableRow {
  const win = goalsFor > goalsAgainst;
  const draw = goalsFor === goalsAgainst;
  const loss = goalsFor < goalsAgainst;
  const points = win ? 3 : draw ? 1 : 0;
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
    if (fixture.leagueId !== league.id || fixture.status !== "played" || !fixture.result) {
      continue;
    }

    const home = rows.get(fixture.homeClubId);
    const away = rows.get(fixture.awayClubId);

    if (!home || !away) {
      continue;
    }

    rows.set(fixture.homeClubId, applyResult(home, fixture.result.homeGoals, fixture.result.awayGoals));
    rows.set(fixture.awayClubId, applyResult(away, fixture.result.awayGoals, fixture.result.homeGoals));
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

export function calculatePromotionRelegationStatus(
  k1Table: readonly LeagueTableRow[],
  k2Table: readonly LeagueTableRow[],
): PromotionRelegationStatus {
  const k1Bottom = k1Table.at(-1);
  const k1Playoff = k1Table.at(-2);
  const k2Top = k2Table[0];
  const k2Playoff = k2Table[1];

  return {
    automaticRelegationClubId: k1Bottom?.clubId,
    playoffClubId: k1Playoff?.clubId,
    automaticPromotionClubId: k2Top?.clubId,
    promotionPlayoffClubId: k2Playoff?.clubId,
    note: k1Bottom && k2Top
      ? `${k1Bottom.clubName}은 자동 강등권, ${k2Top.clubName}은 자동 승격권입니다.`
      : "승강 상태를 계산할 수 없습니다.",
  };
}
