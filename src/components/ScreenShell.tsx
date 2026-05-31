import type { ReactNode } from "react";

interface ScreenShellProps {
  eyebrow: ReactNode;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
}

export function ScreenShell({ eyebrow, title, children, actions, wide = false }: ScreenShellProps) {
  return (
    <main className="app-shell">
      <section className={wide ? "screen-panel screen-panel-wide" : "screen-panel"} aria-labelledby="screen-title">
        <header className="screen-heading">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h1 id="screen-title">{title}</h1>
          </div>
          {actions ? <div className="screen-actions">{actions}</div> : null}
        </header>
        <div className="screen-body">{children}</div>
      </section>
    </main>
  );
}
