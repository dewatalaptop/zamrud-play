import { useEffect, useRef, useState } from "react";
import { Dices } from "lucide-react";
import { useI18n } from "../../i18n";
import { useMotion } from "../../lib/hooks";
import { WinFx } from "./WinFx";
import { GameResultModal } from "../GameResultModal";
import { BalanceBar, StakePicker, useRound, wait, type GameProps } from "./shared";

/** Pengembalian = floor(taruhan × payoutNumerator / jumlahAngkaMenang) — sama persis dengan aturan server. */
const ret = (stake: number, num: number, k: number) => Math.floor((stake * num) / k);

export default function DiceGame({ game }: GameProps) {
  const { t, n } = useI18n();
  const m = useMotion();
  const cfg = game.rules;
  const { start, busy } = useRound(game.slug);
  const [stake, setStake] = useState<number>(cfg.stakeSteps[1] ?? cfg.stakeSteps[0]);
  const [mode, setMode] = useState<"under" | "over">("under");
  const [target, setTarget] = useState(50);
  const [shown, setShown] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [cel, setCel] = useState(false);
  const [last, setLast] = useState<{ roll: number; win: boolean; profit: boolean; stake: number; payout: number; mode: string; target: number } | null>(null);
  const [recent, setRecent] = useState<{ roll: number; win: boolean; profit: boolean; mode: string; target: number }[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => () => clearInterval(timer.current), []);

  const k = mode === "under" ? target - 1 : cfg.sides - target;
  const valid = k >= cfg.minWinningNumbers && k <= cfg.maxWinningNumbers;
  const chance = Math.round((k / cfg.sides) * 1000) / 10;
  const minT = mode === "under" ? cfg.minWinningNumbers + 1 : cfg.sides - cfg.maxWinningNumbers;
  const maxT = mode === "under" ? cfg.maxWinningNumbers + 1 : cfg.sides - cfg.minWinningNumbers;

  const roll = async () => {
    if (!valid) return;
    setRolling(true);
    if (!m.reduced) timer.current = setInterval(() => setShown(Math.floor(Math.random() * cfg.sides) + 1), 70);
    const r = await start({ stake, mode, target });
    clearInterval(timer.current);
    if (!r) { setRolling(false); return; }
    if (!m.reduced) await wait(700);
    const v = r.view;
    const win = r.payout > 0 && ((mode === "under" && v.roll < target) || (mode === "over" && v.roll > target));
    const profit = win && r.payout > r.stake; // pengembalian = taruhan bukan keuntungan
    setShown(v.roll); setRolling(false);
    setLast({ roll: v.roll, win, profit, stake: r.stake, payout: r.payout, mode, target });
    setRecent((x) => [{ roll: v.roll, win, profit, mode, target }, ...x].slice(0, 8));
    if (profit && !m.reduced) { setCel(true); await wait(r.payout / r.stake >= 25 ? 3200 : 2400); setCel(false); }
    setOpen(true);
  };

  return (
    <div className="grid gap-4">
      <BalanceBar />
      <div className="game-stage grid place-items-center gap-3 pb-6 pt-8">
        <div className="slot-title" aria-hidden="true">{t("dice.stageTitle")}</div>
        {last?.profit && !rolling && cel && <WinFx key={last.roll + "-" + last.payout} payout={last.payout} stake={last.stake} reduced={m.reduced} fmt={n} label={{ win: t("slots.tierWin"), big: t("slots.tierBig"), mega: t("slots.tierMega") }} />}
        <div className={`die ${rolling && !m.reduced ? "pulse-soft" : ""}`} style={{ width: 120, height: 120, fontSize: "3rem" }} aria-live="polite" aria-label={shown ? `${t("dice.roll")} ${shown}` : t("dice.ready")}>
          {shown ?? "?"}
        </div>
        <p className="text-sm" style={{ color: "hsl(210 20% 85%)" }}>{rolling ? t("dice.rolling") : last ? (last.win ? (last.profit ? t("dice.hit") : t("dice.hitRefund")) : t("dice.miss")) : t("dice.ready")}</p>
      </div>

      <div className="card grid gap-5">
        <div role="group" aria-label={t("dice.prediction")} className="grid grid-cols-2 gap-2">
          {(["under", "over"] as const).map((md) => (
            <button key={md} className="bet-btn !py-3" aria-pressed={mode === md} disabled={rolling || cel} onClick={() => { setMode(md); setTarget(50); }}>{t(`dice.${md}`)}</button>
          ))}
        </div>
        <label className="grid gap-2 text-sm font-semibold">
          <span className="flex items-center justify-between">{t("dice.target")}<span className="num font-display text-xl">{target}</span></span>
          <input type="range" min={minT} max={maxT} value={Math.min(Math.max(target, minT), maxT)} disabled={rolling || cel} onChange={(e) => setTarget(Number(e.target.value))} className="w-full accent-emerald-500" aria-valuetext={`${t(`dice.${mode}`)} ${target}`} />
        </label>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-surface-2 p-3"><dt className="text-xs text-faint">{t("dice.chance")}</dt><dd className="num font-bold">{chance}%</dd></div>
          <div className="rounded-2xl bg-surface-2 p-3"><dt className="text-xs text-faint">{t("dice.winningNumbers")}</dt><dd className="num font-bold">{valid ? k : "—"}</dd></div>
          <div className="rounded-2xl bg-surface-2 p-3"><dt className="text-xs text-faint">{t("game.returned")}</dt><dd className="num font-bold">{valid ? n(ret(stake, cfg.payoutNumerator, k)) : "—"}</dd></div>
        </dl>
        <div>
          <p className="mb-2 text-sm font-semibold">{t("game.stake")}</p>
          <StakePicker steps={cfg.stakeSteps} value={stake} onChange={setStake} disabled={rolling || cel} label={t("game.stake")} />
        </div>
        <button className="btn btn-primary btn-lg" disabled={busy || rolling || cel || !valid} onClick={roll}><Dices size={18} />{t("dice.rollNow")} · {n(stake)}</button>
        <p className="text-xs text-faint">{t("dice.fairNote")}</p>
      </div>

      {recent.length > 0 && (
        <section className="card" aria-label={t("game.recent")}>
          <h3 className="mb-3 text-sm font-bold">{t("game.recent")}</h3>
          <ul className="flex flex-wrap gap-2">
            {recent.map((r, i) => <li key={i} className={`chip ${r.profit ? "!bg-[var(--success-bg)] !text-ok" : ""}`}><span className="num font-bold">{r.roll}</span> · {t(`dice.${r.mode}`)} {r.target}</li>)}
          </ul>
        </section>
      )}
      {last && (
        <GameResultModal open={open} onClose={() => setOpen(false)} onAgain={() => { setOpen(false); void roll(); }} title={t("game.roundResult")} stake={last.stake} payout={last.payout}>
          <p className="text-center text-sm text-muted">{t("dice.summary", { roll: last.roll, mode: t(`dice.${last.mode}`), target: last.target })}</p>
        </GameResultModal>
      )}
    </div>
  );
}
