import type { ReactNode } from "react";
import type { MatchLineup } from "../../domain/types";
import { MatchPlayerRow } from "./MatchPlayerRow";

export function LineupPanel({ title, lineup }: { title: ReactNode; lineup: MatchLineup }) {
  return (
    <section className="data-panel match-roster-panel">
      <div className="match-panel-heading">
        <h2>{title}</h2>
        <span>{lineup.formation}</span>
      </div>
      <ol className="match-player-list">
        {lineup.starters.map((player) => (
          <MatchPlayerRow key={player.playerId} player={player} />
        ))}
      </ol>
    </section>
  );
}
