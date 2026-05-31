import type { ReactNode } from "react";

interface TeamNameLinkProps {
  clubId: string;
  children: ReactNode;
  onOpenTeam: (clubId: string) => void;
  className?: string;
}

function getAccessibleName(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  return "팀";
}

export function TeamNameLink({
  clubId,
  children,
  onOpenTeam,
  className,
}: TeamNameLinkProps) {
  const classNames = ["team-name-link", className].filter(Boolean).join(" ");
  const name = getAccessibleName(children);

  return (
    <button
      type="button"
      className={classNames}
      aria-label={`${name} 팀 정보 열기`}
      onClick={() => onOpenTeam(clubId)}
    >
      {children}
    </button>
  );
}
