import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { Play, RotateCw, Square } from "lucide-react";
import { useI18n } from "../../i18n";
import { useMotion } from "../../lib/hooks";
import { GameResultModal } from "../GameResultModal";
import { SymbolIcon } from "./art";
import { symbolTier } from "./symbols";
import { WinFx } from "./WinFx";
import { signed } from "../../lib/outcome";
import { sfx } from "../../lib/sound";
import { BalanceBar, StakePicker, useRound, wait, type GameProps } from "./shared";

const ROWS = 3;
const FILLER = 12;
const LINES = 10;
interface Win { line: number; symbol: string; count: number; mult: number; cells: number[] }
interface Scat { count: number; mult: number; cells: number[] }

/** Satu gulungan 3 baris. Strip acak (murni visual) berakhir di tiga simbol hasil dari server. */
function GridReel({ symbols, target, spinning, delay, motionOn, hit, dim }: { symbols: string[]; target: string[]; spinning: number; delay: number; motionOn: boolean; hit: Set<number>; dim: boolean }) {
  const controls = useAnimationControls();
  const [thud, setThud] = useState(0);
  const [strip, setStrip] = useState<string[]>(target);
  useEffect(() => {
    if (spinning === 0) return;
    const filler = Array.from({ length: FILLER }, () => symbols[Math.floor(Math.random() * symbols.length)]);
    setStrip((prev) => [...prev.slice(-ROWS), ...filler, ...target]);
  }, [spinning]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (strip.length <= ROWS) return;
    controls.set({ y: "0%" });
    const end = `-${((strip.length - ROWS) / strip.length) * 100}%`;
    if (motionOn) void controls.start({ y: end, transition: { duration: 0.9 + delay, ease: [0.2, 0.7, 0.2, 1] } }).then(() => { setThud((x) => x + 1); sfx("stop"); });
    else controls.set({ y: end });
  }, [strip]); // eslint-disable-line react-hooks/exhaustive-deps
  const base = strip.length - ROWS;
  return (
    <div className={`greel ${thud && motionOn ? (thud % 2 ? "reel-thud-a" : "reel-thud-b") : ""}`} aria-hidden="true">
      <motion.div className="greel-strip" animate={controls} initial={{ y: "0%" }}>
        {strip.map((s, i) => {
          const row = i - base;
          const final = row >= 0;
          const lit = final && hit.has(row);
          return <div key={i} className={`greel-cell ${symbolTier(s) === "high" ? "rare" : ""} ${lit ? "gcell-win" : final && dim ? "gcell-dim" : ""}`}><SymbolIcon id={s} size={64} /></div>;
        })}
      </motion.div>
    </div>
  );
}

const cellSet = (col: number, wins: Win[], scat: Scat): Set<number> => {
  const out = new Set<number>();
  for (const w of wins) for (const c of w.cells) if (Math.floor(c / ROWS) === col) out.add(c % ROWS);
  for (const c of scat.cells) if (Math.floor(c / ROWS) === col) out.add(c % ROWS);
  return out;
};

export default function SlotsGrid({ game }: GameProps) {
  const { t, n } = useI18n();
  const m = useMotion();
  const cfg = game.rules;
  const symbols: string[] = cfg.symbols.map((s: any) => s.id);
  const reelsN: number = cfg.reels ?? 5;
  const { start, busy } = useRound(game.slug);
  const [stake, setStake] = useState<number>(cfg.stakeSteps[1] ?? cfg.stakeSteps[0]);
  const [grid, setGrid] = useState<string[][]>(() => Array.from({ length: reelsN }, (_, c) => Array.from({ length: ROWS }, (_, r) => symbols[(c * 2 + r * 3) % 6])));
  const [spin, setSpin] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [autoNote, setAutoNote] = useState("");
  const stopRef = useRef(false);
  useEffect(() => () => { stopRef.current = true; }, []);
  const [result, setResult] = useState<{ stake: number; payout: number; grid: string[][]; wins: Win[]; scatter: Scat; mult: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<{ wins: number; net: number }[]>([]);

  const spinNow = async (auto = false): Promise<{ mult: number; net: number } | null> => {
    const r = await start({ stake });
    if (!r) return null;
    const v = r.view as { grid: string[][]; wins: Win[]; scatter: Scat };
    setGrid(v.grid); setSpin((x) => x + 1); setAnimating(true);
    await wait(m.reduced ? 120 : 2050);
    setAnimating(false);
    const mult = r.stake ? r.payout / r.stake : 0;
    // Sorotan hanya untuk kemenangan nyata (total > taruhan); hasil di bawah/sama dengan taruhan tidak disamarkan sebagai menang.
    const real = r.payout > r.stake;
    setResult({ stake: r.stake, payout: r.payout, grid: v.grid, wins: real ? v.wins : [], scatter: real ? v.scatter : { count: v.scatter.count, mult: 0, cells: [] }, mult });
    setRecent((x) => [{ wins: v.wins.length, net: r.net ?? 0 }, ...x].slice(0, 6));
    if (mult > 1 && !m.reduced) { setCelebrating(true); await wait(auto ? 1300 : mult >= 25 ? 3200 : 2400); setCelebrating(false); }
    if (!auto) setOpen(true);
    return { mult, net: r.net ?? 0 };
  };
  // Autoplay dibatasi: sama dengan slot klasik (maks 10 putaran, jeda, berhenti pada kemenangan besar/rugi besar/dialog/tab tersembunyi).
  const AUTO_MAX_LOSS_X = 8;
  const runAuto = async (count: number) => {
    stopRef.current = false; setAutoNote(""); let net = 0, done = 0, why = "";
    for (let i = count; i > 0; i--) {
      setAutoLeft(i);
      const o = await spinNow(true);
      if (!o) { why = "error"; break; }
      done++; net += o.net;
      if (stopRef.current) { why = "manual"; break; }
      if (o.mult >= 8) { why = "bigwin"; break; }
      if (net <= -AUTO_MAX_LOSS_X * stake) { why = "loss"; break; }
      if (document.hidden || document.querySelector("[role=dialog]")) { why = "paused"; break; }
      if (i > 1) await wait(m.reduced ? 300 : 900);
    }
    setAutoLeft(0);
    setAutoNote(t("slots.autoDone", { rounds: done, net: signed(net, n), why: t(`slots.autoWhy_${why || "end"}`) }));
  };
  const win = !animating && !!result && result.payout > result.stake;
  const perLine = stake / LINES;
  const shownWins = win && result ? result.wins.slice(0, 3) : [];

  return (
    <div className="grid gap-4">
      <BalanceBar />
      <div className="slot-machine">
        <picture className="slot-bgfx" aria-hidden="true">
          <source media="(max-width: 640px)" srcSet="/img/slot-bg-portrait.webp" />
          <img src="/img/slot-bg.webp" alt="" width={1000} height={558} decoding="async" />
        </picture>
        <div className="slot-title" aria-hidden="true"><SymbolIcon id="DIAMOND" size={20} />{t("slots5.title")}<SymbolIcon id="DIAMOND" size={20} /></div>
        <div className={`slot-reels ${win ? "is-win" : ""}`} role="img" aria-label={`${t("slots5.rowsLabel")}: ${(result?.grid ?? grid).map((c) => c.map((s) => t(`slots.symbols.${s}`)).join("/")).join(" | ")}`}>
          <div className="greels" style={{ gridTemplateColumns: `repeat(${reelsN}, minmax(0, 1fr))` }}>
            {grid.map((col, i) => (
              <GridReel key={i} symbols={symbols} target={col} spinning={spin} delay={i * 0.22} motionOn={!m.reduced}
                hit={!animating && win && result ? cellSet(i, result.wins, result.scatter) : new Set()} dim={win} />
            ))}
          </div>
        </div>
        <div className="slot-hud">
          <div><small>{t("game.stake")}</small><b>{n(stake)}</b><span className="gl-sub">{t("slots5.lines")} × {n(perLine)}</span></div>
          <div><small>{t("slots.lastWin")}</small><b>{win && result ? n(result.payout) : "—"}</b></div>
        </div>
        {celebrating && win && result && <WinFx key={spin} payout={result.payout} stake={result.stake} reduced={m.reduced} fmt={n}
          label={{ win: t("slots.tierWin"), big: t("slots.tierBig"), mega: t("slots.tierMega") }} />}
        <p className="slot-msg mt-3 min-h-5 text-center text-sm" aria-live="polite">
          {animating ? t("slots.spinning")
            : result ? (result.payout > result.stake ? t("slots5.matched", { mult: result.mult })
              : result.payout === result.stake ? t("slots.refunded")
              : result.payout > 0 ? t("slots5.partial", { payout: n(result.payout), stake: n(result.stake) }) : t("slots.noMatch"))
            : t("slots.ready")}
        </p>
        {shownWins.length > 0 && (
          <ul className="gl-wins" aria-label={t("slots5.lines")}>
            {shownWins.map((w) => <li key={w.line}>{t("slots5.winLine", { line: w.line, symbol: t(`slots.symbols.${w.symbol}`), count: w.count, coins: n(perLine * w.mult) })}</li>)}
            {result && result.scatter.mult > 0 && <li>{t("slots5.scatterWin", { count: result.scatter.count, coins: n(result.stake * result.scatter.mult) })}</li>}
            {result && result.wins.length > shownWins.length && <li>{t("slots5.more", { n: result.wins.length - shownWins.length })}</li>}
          </ul>
        )}
      </div>
      <div className="card grid gap-4">
        <div>
          <p className="mb-2 text-sm font-semibold">{t("game.stake")}</p>
          <StakePicker steps={cfg.stakeSteps} value={stake} onChange={setStake} disabled={busy || animating || celebrating || autoLeft > 0} label={t("game.stake")} />
        </div>
        <div className="flex items-stretch gap-2">
          <button className="btn btn-primary btn-lg spin-cta flex-1" onClick={() => void spinNow()} disabled={busy || animating || celebrating || autoLeft > 0}><RotateCw size={18} className={animating ? "animate-spin" : ""} />{t("slots.spin")} · {n(stake)}</button>
          {autoLeft > 0
            ? <button className="btn btn-secondary btn-lg" onClick={() => { stopRef.current = true; }}><Square size={16} />{t("slots.autoStop", { left: autoLeft })}</button>
            : <button className="btn btn-secondary btn-lg" onClick={() => void runAuto(10)} disabled={busy || animating || celebrating}><Play size={16} />{t("slots.autoStart", { n: 10 })}</button>}
        </div>
        {autoNote && <p className="text-sm text-muted" role="status">{autoNote}</p>}
      </div>
      {recent.length > 0 && (
        <section className="card" aria-label={t("game.recent")}>
          <h3 className="mb-3 text-sm font-bold">{t("game.recent")}</h3>
          <ul className="grid gap-2">
            {recent.map((r, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
                <span className="text-sm text-muted">{t("slots5.summary", { wins: r.wins })}</span>
                <span className="num text-sm font-semibold">{r.net > 0 ? "+" : r.net < 0 ? "−" : ""}{n(Math.abs(r.net))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {result && (
        <GameResultModal open={open} onClose={() => setOpen(false)} onAgain={() => { setOpen(false); void spinNow(); }}
          title={t("game.roundResult")} stake={result.stake} payout={result.payout}>
          <div className="grid justify-center gap-1" style={{ gridTemplateColumns: `repeat(${reelsN}, auto)` }}>
            {Array.from({ length: ROWS }, (_, r) => result.grid.map((col, c) => <SymbolIcon key={`${c}-${r}`} id={col[r]} size={40} />))}
          </div>
        </GameResultModal>
      )}
    </div>
  );
}
