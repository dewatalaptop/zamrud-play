import { useId } from "react";

/** Simbol slot — SVG orisinal (tanpa aset eksternal). */
export function SymbolIcon({ id, size = 72 }: { id: string; size?: number }) {
  const uid = useId().replace(/:/g, "");
  const common = { width: size, height: size, viewBox: "0 0 64 64", role: "img", "aria-label": id.toLowerCase() } as const;
  switch (id) {
    case "CHERRY":
      return (
        <svg {...common}>
          <path d="M30 14c0 12-8 20-14 30M36 14c2 12 8 20 14 30" stroke="#4ade80" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M30 14c6-4 14-4 18 2-6 2-12 2-18-2Z" fill="#22c55e" />
          <circle cx="16" cy="46" r="10" fill="#dc2626" /><circle cx="50" cy="46" r="10" fill="#e11d48" />
          <circle cx="13" cy="43" r="3" fill="#fff" opacity=".45" /><circle cx="47" cy="43" r="3" fill="#fff" opacity=".45" />
        </svg>
      );
    case "LEMON":
      return (
        <svg {...common}>
          <ellipse cx="32" cy="34" rx="22" ry="16" fill="#facc15" transform="rotate(-18 32 34)" />
          <path d="M10 44c-3 1-5 0-6-2M54 24c3-1 5 0 6 2" stroke="#eab308" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="26" cy="29" rx="8" ry="4" fill="#fff" opacity=".4" transform="rotate(-18 26 29)" />
        </svg>
      );
    case "BELL":
      return (
        <svg {...common}>
          <path d="M32 8a4 4 0 0 1 4 4v1c8 2 12 9 12 18l3 10H13l3-10c0-9 4-16 12-18v-1a4 4 0 0 1 4-4Z" fill="#fbbf24" />
          <path d="M20 30c0-6 3-11 9-13" stroke="#fff" strokeWidth="3" opacity=".5" strokeLinecap="round" fill="none" />
          <rect x="11" y="41" width="42" height="5" rx="2.500" fill="#f59e0b" /><circle cx="32" cy="52" r="5" fill="#b45309" />
        </svg>
      );
    case "CLOVER":
      return (
        <svg {...common}>
          {[[24, 22], [40, 22], [24, 38], [40, 38]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="11" fill={i % 2 ? "#16a34a" : "#22c55e"} />)}
          <path d="M32 34c-1 10 2 16 8 22" stroke="#15803d" strokeWidth="4" strokeLinecap="round" fill="none" />
          <circle cx="21" cy="19" r="3" fill="#fff" opacity=".35" />
        </svg>
      );
    case "STAR":
      return (
        <svg {...common}>
          <defs><linearGradient id={uid} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#fde047" /><stop offset="1" stopColor="#f59e0b" /></linearGradient></defs>
          <path d="m32 5 8 17 19 2-14 13 4 19-17-10-17 10 4-19L5 24l19-2Z" fill={`url(#${uid})`} stroke="#b45309" strokeWidth="1.500" strokeLinejoin="round" />
        </svg>
      );
    case "DIAMOND":
      return (
        <svg {...common}>
          <path d="M32 8 54 28 32 58 10 28Z" fill="#22d3ee" />
          <path d="M32 8 54 28H10Z" fill="#67e8f9" /><path d="M10 28 32 58 24 28ZM54 28 32 58 40 28Z" fill="#06b6d4" />
          <path d="M20 22l5-8" stroke="#fff" strokeWidth="2.500" opacity=".6" strokeLinecap="round" />
        </svg>
      );
    case "SEVEN":
      return (
        <svg {...common}>
          <defs><linearGradient id={uid} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fb7185" /><stop offset="1" stopColor="#be123c" /></linearGradient></defs>
          <path d="M12 12h40v9L30 54h-12l20-31H12Z" fill={`url(#${uid})`} stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    default:
      return <svg {...common}><circle cx="32" cy="32" r="20" fill="#64748b" /></svg>;
  }
}

/** Ilustrasi kartu game (CSS/SVG orisinal). */
export function GameArt({ slug, className = "" }: { slug: string; className?: string }) {
  const base = `relative isolate grid place-items-center overflow-hidden ${className}`;
  const glow = <div className="absolute inset-0 -z-10 opacity-70" style={{ background: "radial-gradient(60% 60% at 50% 40%, hsl(155 70% 35% / .45), transparent 70%)" }} />;
  if (slug === "virtual-slots")
    return (
      <div className={base} style={{ background: "linear-gradient(135deg,hsl(262 45% 20%),hsl(224 40% 10%))" }}>
        {glow}
        <div className="flex gap-2">{["SEVEN", "DIAMOND", "STAR"].map((s) => <div key={s} className="rounded-xl border border-white/10 bg-black/30 p-1.5"><SymbolIcon id={s} size={46} /></div>)}</div>
      </div>
    );
  if (slug === "euro-roulette")
    return (
      <div className={base} style={{ background: "linear-gradient(135deg,hsl(155 55% 18%),hsl(224 40% 9%))" }}>
        {glow}
        <svg width="132" height="132" viewBox="0 0 120 120" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M60 60 60 8A52 52 0 0 1 82 12.500Z" transform={`rotate(${i * 30} 60 60)`} fill={i === 0 ? "#15803d" : i % 2 ? "#b91c1c" : "#111827"} stroke="#fbbf24" strokeWidth=".6" />
          ))}
          <circle cx="60" cy="60" r="22" fill="hsl(224 30% 12%)" stroke="#fbbf24" strokeWidth="2" /><circle cx="60" cy="60" r="5" fill="#fbbf24" />
          <circle cx="60" cy="14" r="4" fill="#fff" />
        </svg>
      </div>
    );
  if (slug === "blackjack-21")
    return (
      <div className={base} style={{ background: "linear-gradient(135deg,hsl(155 50% 16%),hsl(224 40% 9%))" }}>
        {glow}
        <div className="flex -space-x-5">
          {[["A", "♠", false, -10], ["K", "♥", true, 6]].map(([r, s, red, rot], i) => (
            <div key={i} className={`pcard ${red ? "red" : ""}`} style={{ transform: `rotate(${rot}deg)`, width: 66, height: 94 }}>
              <span className="corner">{r as string}<span style={{ fontSize: ".8rem" }}>{s as string}</span></span><span className="pip">{s as string}</span>
            </div>
          ))}
        </div>
      </div>
    );
  return (
    <div className={base} style={{ background: "linear-gradient(135deg,hsl(224 50% 22%),hsl(224 40% 9%))" }}>
      {glow}
      <div className="flex gap-3">
        <div className="die" style={{ transform: "rotate(-12deg)", width: 62, height: 62, fontSize: "1.5rem" }}>4</div>
        <div className="die" style={{ transform: "rotate(10deg) translateY(10px)", width: 62, height: 62, fontSize: "1.5rem" }}>6</div>
      </div>
    </div>
  );
}
