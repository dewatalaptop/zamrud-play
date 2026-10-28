import type { ReactNode } from "react";

/** Ilustrasi opsional (berkas di public/img); bila diberikan, menggantikan ikon. */
const ART = { data: "/img/empty-no-data.webp", rank: "/img/empty-no-rank.webp", notfound: "/img/empty-not-found.webp" } as const;

export function EmptyState({ icon, art, title, text, action }: { icon?: ReactNode; art?: keyof typeof ART; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty-state" role="status">
      {art && <span className="block overflow-hidden rounded-2xl" style={{ width: 220, maxWidth: "100%" }}><img src={ART[art]} alt="" width={220} height={164} loading="lazy" decoding="async" className="!w-full scale-[1.4]" /></span>}
      {!art && icon && <div className="mb-1 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-400">{icon}</div>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}
