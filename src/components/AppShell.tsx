import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
  header: ReactNode;
  labelledBy?: string;
  navigation?: ReactNode;
  variant?: "default" | "start" | "match";
  wide?: boolean;
}

export function AppShell({
  children,
  header,
  labelledBy,
  navigation,
  variant = "default",
  wide = false,
}: AppShellProps) {
  const panelClassName = [
    "screen-panel",
    variant !== "default" ? `screen-panel-${variant}` : "",
    wide ? "screen-panel-wide" : "",
    navigation ? "screen-panel-with-nav" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="app-shell">
      <section className={panelClassName} aria-labelledby={labelledBy}>
        <div className="app-shell-header">{header}</div>
        {navigation ? <div className="app-shell-nav">{navigation}</div> : null}
        <div className="app-shell-main">
          <div className="screen-body">{children}</div>
        </div>
      </section>
    </main>
  );
}
