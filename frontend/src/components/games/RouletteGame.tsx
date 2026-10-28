import { useMemo, useState } from "react";
import { Eraser, Play } from "lucide-react";
import { useI18n } from "../../i18n";
import { useMotion } from "../../lib/hooks";
import { WinFx } from "./WinFx";
import { GameResultModal } from "../GameResultModal";
import { BalanceBar, StakePicker, useRound, wait, type GameProps } from "./shared";

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const colorOf = (n: number) => (n === 0 ? "green" : RED.has(n) ? "red" : "black");
// Urutan kantong roda Eropa (searah jarum jam dari 0)
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

interface Bet { kind: string; value?: number; stake: number; }
const keyOf = (b: { kind: string; value?: number }) => `${b.kind}:${b.value ?? ""}`;
const FILL = { red: "#b91c1c", black: "#111827", green: "#15803d" };

function Wheel({ angle, animate, ms }: { angle: number; animate: boolean; ms: number }) {
  const R = 100, r0 = 62, step = 360 / WHEEL.length;
  const pt = (a: number, rad: number) => [100 + rad * Math.sin((a * Math.PI) / 180), 100 - rad * Math.cos((a * Math.PI) / 180)];
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <svg viewBox="0 0 200 200" role="img" aria-label="roulette wheel" className="w-full drop-shadow-xl">
        <g className="wheel-spin" style={{ transform: `rotate(${angle}deg)`, transition: animate ? `transform ${ms}ms cubic-bezier(.15,.7,.1,1)` : "none" }}>
          <circle cx="100" cy="100" r="99" fill="#7c5a12" />
          {WHEEL.map((num, i) => {
            const a0 = i * step - step / 2, a1 = i * step + step / 2;
            const [x0, y0] = pt(a0, R - 4), [x1, y1] = pt(a1, R - 4), [x2, y2] = pt(a1, r0), [x3, y3] = pt(a0, r0);
            const [tx, ty] = pt(i * step, 82);
            return (
              <g key={num}>
                <path d={`M${x0} ${y0}A${R - 4} ${R - 4} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`} fill={FILL[colorOf(num)]} stroke="#fbbf24" strokeWidth=".5" />
                <text x={tx} y={ty} fontSize="8" fontWeight="700" fill="#fff" textAnchor="middle" dominantBaseline="central" transform={`rotate(${i * step} ${tx} ${ty})`}>{num}</text>
              </g>
            );
          })}
          <circle cx="100" cy="100" r="56" fill="hsl(224 30% 12%)" stroke="#fbbf24" strokeWidth="2" />
          <circle cx="100" cy="100" r="6" fill="#fbbf24" />
        </g>
        <polygon points="100,2 94,-6 106,-6" fill="#fff" transform="translate(0 8)" />
      </svg>
    </div>
  );
}

export default function RouletteGame({ game }: GameProps) {
  const { t, n } = useI18n();
  const m = useMotion();
  const cfg = game.rules;
  const { start, busy } = useRound(game.slug);
  const [stake, setStake] = useState<number>(cfg.stakeSteps[0]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [angle, setAngle] = useState(0);
  const [anim, setAnim] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [cel, setCel] = useState(false);
  const [last, setLast] = useState<{ number: number; stake: number; payout: number } | null>(null);
  const [open, setOpen] = useState(false);
  const total = useMemo(() => bets.reduce((s, b) => s + b.stake, 0), [bets]);

  const toggle = (kind: string, value?: number) => {
    setBets((cur) => {
      const k = keyOf({ kind, value });
      const ex = cur.find((b) => keyOf(b) === k);
      if (ex) return cur.filter((b) => keyOf(b) !== k);
      if (cur.length >= cfg.maxBets) return cur;
      return [...cur, { kind, value, stake }];
    });
  };
  const has = (kind: string, value?: number) => bets.some((b) => keyOf(b) === keyOf({ kind, value }));

  const spin = async () => {
    if (!bets.length) return;
    setSpinning(true);
    const r = await start({ bets: bets.map((b) => ({ kind: b.kind, ...(b.value !== undefined ? { value: b.value } : {}), stake: b.stake })) });
    if (!r) { setSpinning(false); return; }
    const num = r.view.number as number;
    const idx = WHEEL.indexOf(num);
    const base = Math.ceil(angle / 360) * 360;
    const target = base + (m.reduced ? 0 : 360 * 5) + (360 - idx * (360 / WHEEL.length));
    setAnim(true); setAngle(target);
    await wait(m.reduced ? 200 : 4200);
    setAnim(false); setSpinning(false);
    setLast({ number: num, stake: r.stake, payout: r.payout });
    if (r.payout > r.stake && !m.reduced) { setCel(true); await wait(r.payout / r.stake >= 25 ? 3200 : 2400); setCel(false); }
    setOpen(true);
  };
  const ms = m.reduced ? 100 : 4000;

  const numbers = Array.from({ length: 36 }, (_, i) => i + 1);
  return (
    <div className="grid gap-4">
      <BalanceBar />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="game-stage flex flex-col items-center gap-3">
          <div className="slot-title" aria-hidden="true">{t("roulette.stageTitle")}</div>
          {cel && last && <WinFx key={last.number + "-" + last.payout} payout={last.payout} stake={last.stake} reduced={m.reduced} fmt={n} label={{ win: t("slots.tierWin"), big: t("slots.tierBig"), mega: t("slots.tierMega") }} />}
          <Wheel angle={angle} animate={anim} ms={ms} />
          <p className="min-h-6 text-center text-sm" style={{ color: "hsl(210 20% 85%)" }} aria-live="polite">
            {spinning ? t("roulette.spinning") : last ? t("roulette.landed", { n: last.number, c: t(`roulette.colors.${colorOf(last.number)}`) }) : t("roulette.ready")}
          </p>
        </div>
        <div className="card grid gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold">{t("roulette.chipValue")}</p>
            <StakePicker steps={cfg.stakeSteps} value={stake} onChange={setStake} disabled={spinning || cel} label={t("roulette.chipValue")} />
          </div>
          <div className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-1" role="group" aria-label={t("roulette.numbers")}>
            <button className="roulette-cell rc-green row-span-3 !aspect-auto" aria-pressed={has("straight", 0)} onClick={() => toggle("straight", 0)} aria-label="0">0</button>
            {[3, 2, 1].flatMap((row) => Array.from({ length: 12 }, (_, c) => c * 3 + row)).map((num) => (
              <button key={num} className={`roulette-cell rc-${colorOf(num)}`} aria-pressed={has("straight", num)} onClick={() => toggle("straight", num)} disabled={spinning || cel} aria-label={`${num} ${t(`roulette.colors.${colorOf(num)}`)}`}>{num}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {(["red", "black", "green", "odd", "even", "low", "high"] as const).map((k) => (
              <button key={k} className="bet-btn" aria-pressed={has(k)} disabled={spinning || cel} onClick={() => toggle(k)}>{t(`roulette.kinds.${k}`)}<span className="block text-xs font-normal text-faint">{k === "green" ? cfg.kinds.find((x: any) => x.kind === "green").multiplier : cfg.kinds.find((x: any) => x.kind === k).multiplier}×</span></button>
            ))}
            {[1, 2, 3].map((d) => (
              <button key={d} className="bet-btn" aria-pressed={has("dozen", d)} disabled={spinning || cel} onClick={() => toggle("dozen", d)}>{t("roulette.dozen", { n: d })}<span className="block text-xs font-normal text-faint">{cfg.kinds.find((x: any) => x.kind === "dozen").multiplier}×</span></button>
            ))}
          </div>
          {bets.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label={t("roulette.yourBets")}>
              {bets.map((b) => <li key={keyOf(b)} className="chip">{b.kind === "straight" || b.kind === "dozen" ? `${t(`roulette.kinds.${b.kind}`)} ${b.value}` : t(`roulette.kinds.${b.kind}`)} · <span className="num">{n(b.stake)}</span></li>)}
            </ul>
          )}
          <p className="text-xs text-faint">{t("roulette.maxBets", { n: cfg.maxBets })}</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary btn-lg flex-1" disabled={busy || spinning || cel || !bets.length} onClick={spin}><Play size={18} />{t("roulette.spin")} · {n(total)}</button>
            <button className="btn btn-secondary" disabled={spinning || cel || !bets.length} onClick={() => setBets([])}><Eraser size={16} />{t("roulette.clear")}</button>
          </div>
        </div>
      </div>
      {last && (
        <GameResultModal open={open} onClose={() => setOpen(false)} onAgain={() => { setOpen(false); void spin(); }} title={t("game.roundResult")} stake={last.stake} payout={last.payout}>
          <div className="mb-1 flex items-center justify-center gap-3">
            <span className={`grid h-16 w-16 place-items-center rounded-full font-display text-2xl font-extrabold text-white rc-${colorOf(last.number)}`}>{last.number}</span>
            <span className="text-sm text-muted">{t(`roulette.colors.${colorOf(last.number)}`)}</span>
          </div>
        </GameResultModal>
      )}
    </div>
  );
}
