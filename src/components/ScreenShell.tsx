import type { ReactNode } from "react";

interface ScreenShellProps {
  eyebrow: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function ScreenShell({ eyebrow, title, children, actions }: ScreenShellProps) {
  return (
    <main className="app-shell">
      <section className="screen-panel" aria-labelledby="screen-title">
        <div className="screen-heading">
          <span className="eyebrow">{eyebrow}</span>
          <h1 id="screen-title">{title}</h1>
        </div>
        <div className="screen-body">{children}</div>
        {actions ? <div className="screen-actions">{actions}</div> : null}
      </section>
    </main>
  );
}
