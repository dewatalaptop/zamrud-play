import { SymbolIcon } from "./symbols";

export { SymbolIcon };

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
