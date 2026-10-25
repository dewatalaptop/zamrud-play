import type { ReactNode } from "react";

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty-state" role="status">
      {icon && <div className="mb-1 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-400">{icon}</div>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}
