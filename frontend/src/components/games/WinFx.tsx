import { useEffect, useMemo, useState } from "react";
import { sfx } from "../../lib/sound";

/** Efek kemenangan bertingkat. Hanya dipakai untuk kemenangan nyata (payout > taruhan), bukan pengembalian. */
export type WinTier = "win" | "big" | "mega";
export const winTier = (mult: number): WinTier => (mult >= 25 ? "mega" : mult >= 8 ? "big" : "win");

function useCountUp(target: number, ms: number, instant: boolean) {
  const [v, setV] = useState(instant ? target : 0);
  useEffect(() => {
    if (instant) { setV(target); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, instant]);
  return v;
}

export function WinFx({ payout, stake, label, fmt, reduced }: { payout: number; stake: number; label: Record<WinTier, string>; fmt: (n: number) => string; reduced: boolean }) {
  const mult = stake ? payout / stake : 0;
  const tier = winTier(mult);
  // Suara (bila dinyalakan pemain) hanya untuk kemenangan nyata; komponen ini hanya dipasang saat payout > taruhan.
  useEffect(() => { if (!reduced) sfx(tier === "mega" ? "mega" : tier === "big" ? "big" : "win"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useCountUp(payout, tier === "mega" ? 1800 : 1200, reduced);
  const coins = useMemo(() => {
    const n = tier === "mega" ? 26 : tier === "big" ? 16 : 8;
    return Array.from({ length: n }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.9, dur: 1.4 + Math.random() * 1.1, size: 14 + Math.round(Math.random() * 10), key: i }));
  }, [tier, payout]);
  return (
    <div className={`win-fx win-${tier}`} aria-hidden="true">
      {!reduced && <div className="win-rays" />}
      {!reduced && coins.map((c) => (
        <span key={c.key} className="win-coin" style={{ left: `${c.left}%`, width: c.size, height: c.size, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s` }} />
      ))}
      <div className="win-banner">
        <div className="win-label">{label[tier]}</div>
        <div className="win-amount">{fmt(shown)}</div>
      </div>
    </div>
  );
}
