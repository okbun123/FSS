import type { ReactNode } from "react";
import { getMatchPlayerStatusLabel } from "../../domain/matchEvents";
import type { MatchLineup, MatchPlayer } from "../../domain/types";

function PlayerRow({ player }: { player: MatchPlayer }) {
  return (
    <li className={player.isUserPlayer ? "match-player-row user-player" : "match-player-row"}>
      <span className="player-number">{player.squadNumber ?? "-"}</span>
      <span>
        <strong>{player.name}</strong>
        <small>{player.position}</small>
      </span>
      <span className="player-status">{getMatchPlayerStatusLabel(player)}</span>
    </li>
  );
}

export function LineupPanel({ title, lineup }: { title: ReactNode; lineup: MatchLineup }) {
  return (
    <section className="data-panel match-roster-panel">
      <div className="match-panel-heading">
        <h2>{title}</h2>
        <span>{lineup.formation}</span>
      </div>
      <ol className="match-player-list">
        {lineup.starters.map((player) => (
          <PlayerRow key={player.playerId} player={player} />
        ))}
      </ol>
    </section>
  );
}
