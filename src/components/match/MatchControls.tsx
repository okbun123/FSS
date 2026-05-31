import { getAvailableMatchActions, type MatchAction } from "../../domain/matchStateMachine";
import type { Match } from "../../domain/types";

interface MatchControlsProps {
  match: Match;
  onAction: (action: MatchAction) => void;
}

export function MatchControls({ match, onAction }: MatchControlsProps) {
  const actions = getAvailableMatchActions(match);

  return (
    <section className="data-panel match-controls-panel">
      <h2>경기 진행</h2>
      <div className="match-controls">
        {actions.map((action) => (
          <button
            className={action.id === "CONTINUE" ? "secondary-button" : "primary-button"}
            key={action.id}
            type="button"
            onClick={() => onAction(action.id)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
