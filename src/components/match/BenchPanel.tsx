import type { ReactNode } from "react";
import { getMatchPlayerStatusLabel } from "../../domain/matchEvents";
import type { MatchLineup } from "../../domain/types";

export function BenchPanel({ title, lineup }: { title: ReactNode; lineup: MatchLineup }) {
  return (
    <section className="data-panel match-roster-panel compact-panel">
      <div className="match-panel-heading">
        <h2>{title}</h2>
        <span>벤치</span>
      </div>
      <ol className="match-player-list compact">
        {lineup.substitutes.map((player) => (
          <li className="match-player-row" key={player.playerId}>
            <span className="player-number">{player.squadNumber ?? "-"}</span>
            <span>
              <strong>{player.name}</strong>
              <small>{player.position}</small>
            </span>
            <span className="player-status">{getMatchPlayerStatusLabel(player)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
