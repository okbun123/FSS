import type { Match } from "../../domain/types";

export function PenaltyShootoutPanel({ match }: { match: Match }) {
  const shootout = match.state.shootout;

  if (!shootout) {
    return null;
  }

  return (
    <section className="data-panel penalty-panel">
      <div className="match-panel-heading">
        <h2>승부차기</h2>
        <span>{shootout.homeGoals}-{shootout.awayGoals}</span>
      </div>
      <ol className="shootout-kicks">
        {shootout.kicks.map((kick) => (
          <li className={kick.outcome === "scored" ? "kick-scored" : "kick-missed"} key={kick.id}>
            <span>{kick.team === "home" ? "홈" : "원정"} {kick.round}</span>
            <strong>{kick.playerName ?? "키커"}</strong>
            <small>{kick.outcome === "scored" ? "성공" : "실축"}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}
