import type { ReactNode } from "react";
import type { MatchLineup } from "../../domain/types";
import { MatchPlayerRow } from "./MatchPlayerRow";

export function BenchPanel({ title, lineup }: { title: ReactNode; lineup: MatchLineup }) {
  return (
    <section className="data-panel match-roster-panel compact-panel">
      <div className="match-panel-heading">
        <h2>{title}</h2>
        <span>벤치</span>
      </div>
      <ol className="match-player-list compact">
        {lineup.substitutes.map((player) => (
          <MatchPlayerRow key={player.playerId} player={player} />
        ))}
      </ol>
    </section>
  );
}
