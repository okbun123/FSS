import type { ReactNode } from "react";
import { AppShell } from "./AppShell";

interface ScreenShellProps {
  eyebrow: ReactNode;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  subtitle?: ReactNode;
  navigation?: ReactNode;
  wide?: boolean;
}

export function ScreenShell({
  eyebrow,
  title,
  children,
  actions,
  subtitle,
  navigation,
  wide = false,
}: ScreenShellProps) {
  return (
    <AppShell
      header={
        <header className="screen-heading">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h1 id="screen-title">{title}</h1>
            {subtitle ? <div className="screen-heading-copy">{subtitle}</div> : null}
          </div>
          {actions ? <div className="screen-actions">{actions}</div> : null}
        </header>
      }
      labelledBy="screen-title"
      navigation={navigation}
      wide={wide}
    >
      {children}
    </AppShell>
  );
}
