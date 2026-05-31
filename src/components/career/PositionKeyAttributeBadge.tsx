import type { PositionKeyAttributeRole } from "../../domain/positionKeyAttributes";

const BADGE_LABELS: Record<PositionKeyAttributeRole, string> = {
  primary: "주요",
  secondary: "보조",
};

export function PositionKeyAttributeBadge({ role }: { role?: PositionKeyAttributeRole }) {
  if (!role) {
    return <span className="position-key-badge placeholder" aria-hidden="true" />;
  }

  return (
    <span className={`position-key-badge ${role}`} title={`포지션 ${BADGE_LABELS[role]} 능력치`}>
      {BADGE_LABELS[role]}
    </span>
  );
}
