import { useEffect, useId, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useT } from "../i18n";

export function Logo({ size = 32, withWord = true }: { size?: number; withWord?: boolean }) {
  const id = useId();
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#34d399" /><stop offset="1" stopColor="#047857" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="hsl(224 40% 8%)" stroke="hsl(155 60% 40% / .5)" />
        <path d="M32 9 52 32 32 55 12 32Z" fill={`url(#${id})`} />
        <path d="M32 9 52 32H12Z" fill="#fff" opacity=".22" />
        <circle cx="32" cy="32" r="5" fill="#fbbf24" />
      </svg>
      {withWord && <span className="font-display text-lg font-extrabold tracking-tight">Zamrud<span className="text-brand-400">Play</span></span>}
    </span>
  );
}

/** Koin virtual: ikon netral, sengaja bukan simbol mata uang apa pun. */
export function CoinIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="hsl(43 96% 56%)" />
      <circle cx="12" cy="12" r="7.2" fill="none" stroke="hsl(36 80% 34%)" strokeWidth="1.4" />
      <path d="M12 7.6 15.6 12 12 16.4 8.4 12Z" fill="hsl(36 80% 34%)" />
    </svg>
  );
}

const AVATAR_BG: Record<string, string> = {
  emerald: "from-emerald-400 to-emerald-700", gold: "from-amber-300 to-amber-600", sky: "from-sky-400 to-sky-700",
  violet: "from-violet-400 to-violet-700", rose: "from-rose-400 to-rose-700", slate: "from-slate-400 to-slate-700",
};
export const AVATAR_COLORS = Object.keys(AVATAR_BG);
export const AVATAR_ICONS = ["spade", "heart", "diamond", "club", "crown", "star", "dice", "sparkles"] as const;

const ICON_PATHS: Record<string, ReactNode> = {
  spade: <path d="M12 3c3 4 7 6 7 10a4 4 0 0 1-6.5 3c.2 1.5.8 3 2 5h-5c1.2-2 1.8-3.500 2-5A4 4 0 0 1 5 13c0-4 4-6 7-10Z" />,
  heart: <path d="M12 21C5 15.500 3 12 3 8.800A4.800 4.800 0 0 1 12 6.500 4.800 4.800 0 0 1 21 8.800C21 12 19 15.500 12 21Z" />,
  diamond: <path d="M12 2 20 12 12 22 4 12Z" />,
  club: <path d="M12 3a4 4 0 0 0-3.500 6A4 4 0 1 0 11 14.500c-.2 2-.8 3.500-2 5.500h6c-1.200-2-1.800-3.500-2-5.500A4 4 0 1 0 15.500 9 4 4 0 0 0 12 3Z" />,
  crown: <path d="M3 8l4.500 4L12 5l4.500 7L21 8l-2 11H5Z" />,
  star: <path d="m12 2.500 2.900 6 6.600.9-4.800 4.600 1.200 6.500L12 17.400 6.100 20.500l1.200-6.500L2.500 9.400l6.600-.9Z" />,
  dice: <><rect x="3.500" y="3.500" width="17" height="17" rx="4" /><circle cx="8.500" cy="8.500" r="1.300" fill="#000" opacity=".5" /><circle cx="15.500" cy="15.500" r="1.300" fill="#000" opacity=".5" /></>,
  sparkles: <path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" />,
};

export function UserAvatar({ name, color = "emerald", icon = "spade", size = 40 }: { name: string; color?: string; icon?: string; size?: number }) {
  return (
    <span
      role="img" aria-label={name}
      className={`inline-grid place-items-center rounded-full bg-gradient-to-br ${AVATAR_BG[color] ?? AVATAR_BG.emerald} text-white shadow-md ring-1 ring-white/15`}
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{ICON_PATHS[icon] ?? ICON_PATHS.spade}</svg>
    </span>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="inline-block animate-spin rounded-full border-2 border-current border-r-transparent" style={{ width: size, height: size }} role="status" aria-label="loading" />;
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <div className="card !p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-faint">{icon}{label}</div>
      <div className="num mt-1.5 font-display text-2xl font-extrabold">{value}</div>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Modal aksesibel: role=dialog, fokus terjebak di dalam, Esc menutup, fokus kembali ke pemicu. */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current!;
    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'));
    (focusables()[0] ?? node).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/65 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-3xl sm:rounded-3xl border border-line bg-surface shadow-card ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          <button aria-label={t("common.close")} onClick={onClose} className="btn btn-ghost !p-2"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function ButtonLink({ to, children, variant = "primary", size = "" }: { to: string; children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "gold"; size?: "" | "lg" | "sm" }) {
  return <Link to={to} className={`btn btn-${variant} ${size ? "btn-" + size : ""}`}>{children}</Link>;
}
