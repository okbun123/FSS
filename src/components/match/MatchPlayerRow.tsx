import { getMatchPlayerStatus } from "../../domain/matchEvents";
import type { MatchPlayer } from "../../domain/types";

interface StatusMarker {
  className: string;
  label: string;
}

function getStatusMarkers(player: MatchPlayer): StatusMarker[] {
  const markers: StatusMarker[] = [];
  const status = getMatchPlayerStatus(player);

  if (player.yellowCards > 0) {
    markers.push({
      className: "status-yc",
      label: player.yellowCards > 1 ? `경${player.yellowCards}` : "경",
    });
  }
  if (player.redCard || status === "sentOff") {
    markers.push({ className: "status-rc", label: "퇴" });
  }
  if (player.injured || status === "injured") {
    markers.push({ className: "status-inj", label: "부" });
  }
  if (status === "substituted") {
    markers.push({ className: "status-sub", label: "교" });
  }

  return markers.length > 0 ? markers : [{ className: "status-ok", label: "대" }];
}

export function MatchPlayerRow({ player }: { player: MatchPlayer }) {
  return (
    <li className={player.isUserPlayer ? "match-player-row user-player" : "match-player-row"}>
      <span className="player-number">{player.squadNumber ?? "-"}</span>
      <span className="match-player-copy">
        <strong>{player.name}</strong>
        <small>{player.position}</small>
      </span>
      <span className="player-status-markers" aria-label="선수 상태">
        {getStatusMarkers(player).map((marker) => (
          <span className={`status-marker ${marker.className}`} key={`${marker.className}-${marker.label}`}>
            {marker.label}
          </span>
        ))}
      </span>
    </li>
  );
}
