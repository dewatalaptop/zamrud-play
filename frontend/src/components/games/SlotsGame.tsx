import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { Play, RotateCw, Square } from "lucide-react";
import { useI18n } from "../../i18n";
import { useMotion } from "../../lib/hooks";
import { GameResultModal } from "../GameResultModal";
import { SymbolIcon } from "./art";
import { WinFx } from "./WinFx";
import { signed } from "../../lib/outcome";
import { BalanceBar, StakePicker, useRound, wait, type GameProps } from "./shared";

const CELL = 128;
const FILLER = 14;

function Reel({ symbols, target, spinning, delay, win, motionOn }: { symbols: string[]; target: string; spinning: number; delay: number; win: boolean; motionOn: boolean }) {
  const controls = useAnimationControls();
  const [strip, setStrip] = useState<string[]>([target]);
  // Strip acak (murni visual) yang berakhir di simbol hasil dari server.
  useEffect(() => {
    if (spinning === 0) return;
    const filler = Array.from({ length: FILLER }, () => symbols[Math.floor(Math.random() * symbols.length)]);
    setStrip((prev) => [prev[prev.length - 1], ...filler, target]);
  }, [spinning]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (strip.length < 2) return;
    controls.set({ y: 0 });
    const end = -(strip.length - 1) * CELL;
    if (motionOn) void controls.start({ y: end, transition: { duration: 1.1 + delay, ease: [0.2, 0.7, 0.2, 1] } });
    else controls.set({ y: end });
  }, [strip]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`reel ${win ? "reel-win" : ""}`} role="img" aria-label={target}>
      <motion.div className="reel-strip" animate={controls} initial={{ y: 0 }}>
        {strip.map((s, i) => <div key={i} className="reel-cell"><SymbolIcon id={s} size={92} /></div>)}
      </motion.div>
    </div>
  );
}

export default function SlotsGame({ game }: GameProps) {
  const { t, n } = useI18n();
  const m = useMotion();
  const cfg = game.rules;
  const symbols: string[] = cfg.symbols.map((s: any) => s.id);
  const { start, busy } = useRound(game.slug);
  const [stake, setStake] = useState<number>(cfg.stakeSteps[1] ?? cfg.stakeSteps[0]);
  const [reels, setReels] = useState<string[]>(["CHERRY", "BELL", "LEMON"]);
  const [spin, setSpin] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [autoNote, setAutoNote] = useState("");
  const stopRef = useRef(false);
  useEffect(() => () => { stopRef.current = true; }, []);
  const [result, setResult] = useState<{ stake: number; payout: number; reels: string[]; mult: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<{ reels: string[]; net: number }[]>([]);

  const spinNow = async (auto = false): Promise<{ mult: number; net: number } | null> => {
    const r = await start({ stake });
    if (!r) return null;
    const out = r.view.reels as string[];
    setReels(out); setSpin((x) => x + 1); setAnimating(true);
    await wait(m.reduced ? 120 : 2100);
    setAnimating(false);
    const mult = r.stake ? r.payout / r.stake : 0;
    setResult({ stake: r.stake, payout: r.payout, reels: out, mult });
    setRecent((x) => [{ reels: out, net: (r.net ?? 0) }, ...x].slice(0, 6));
    if (mult > 1 && !m.reduced) { setCelebrating(true); await wait(auto ? 1300 : mult >= 25 ? 3200 : 2400); setCelebrating(false); }
    if (!auto) setOpen(true);
    return { mult, net: r.net ?? 0 };
  };
  // Autoplay dibatasi: maks 10 putaran, jeda antarronde, berhenti otomatis pada kemenangan besar, rugi beruntun,
  // saldo/batas bermain bermasalah, dialog (mis. pengingat sesi) muncul, atau tab disembunyikan.
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
  const win = !animating && !!result && result.payout > result.stake; // pengembalian = taruhan bukan kemenangan

  return (
    <div className="grid gap-4">
      <BalanceBar />
      <div className="slot-machine">
        <div className="slot-title" aria-hidden="true"><SymbolIcon id="DIAMOND" size={20} />{t("slots.title")}<SymbolIcon id="DIAMOND" size={20} /></div>
        <div className={`slot-reels ${win ? "is-win" : ""}`}>
          <div className="slot-payline" aria-hidden="true" />
          <div className="grid grid-cols-3 gap-3" aria-live="polite">
            {reels.map((s, i) => <Reel key={i} symbols={symbols} target={s} spinning={spin} delay={i * 0.35} win={win} motionOn={!m.reduced} />)}
          </div>
        </div>
        <div className="slot-hud">
          <div><small>{t("game.stake")}</small><b>{n(stake)}</b></div>
          <div><small>{t("slots.lastWin")}</small><b>{!animating && result && result.payout > result.stake ? n(result.payout) : "—"}</b></div>
        </div>
        {celebrating && win && result && <WinFx key={spin} payout={result.payout} stake={result.stake} reduced={m.reduced} fmt={n}
          label={{ win: t("slots.tierWin"), big: t("slots.tierBig"), mega: t("slots.tierMega") }} />}
        <p className="slot-msg mt-3 min-h-5 text-center text-sm" aria-live="polite">
          {animating ? t("slots.spinning") : result ? (result.payout > result.stake ? t("slots.matched", { mult: result.mult }) : result.payout === result.stake ? t("slots.refunded") : t("slots.noMatch")) : t("slots.ready")}
        </p>
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
                <span className="flex gap-1">{r.reels.map((s, j) => <SymbolIcon key={j} id={s} size={26} />)}</span>
                <span className="num text-sm font-semibold">{r.net > 0 ? "+" : r.net < 0 ? "−" : ""}{n(Math.abs(r.net))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {result && (
        <GameResultModal open={open} onClose={() => setOpen(false)} onAgain={() => { setOpen(false); void spinNow(); }}
          title={t("game.roundResult")} stake={result.stake} payout={result.payout}>
          <div className="flex justify-center gap-2">{result.reels.map((s, i) => <SymbolIcon key={i} id={s} size={56} />)}</div>
        </GameResultModal>
      )}
    </div>
  );
}
