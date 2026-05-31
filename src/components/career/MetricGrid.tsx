import type { ReactNode } from "react";

export interface MetricItem {
  label: string;
  value: ReactNode;
  tone?: "default" | "good" | "warning";
}

export function MetricGrid({ items }: { items: MetricItem[] }) {
  return (
    <dl className="metric-grid">
      {items.map((item) => (
        <div className={item.tone ? `metric-${item.tone}` : undefined} key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
