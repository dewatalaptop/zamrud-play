import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Hand, Layers2, Plus, Play } from "lucide-react";
import { api, ApiError, newRequestId } from "../../lib/api";
import { useAuth } from "../../auth/AuthProvider";
import { useI18n } from "../../i18n";
import { useMotion } from "../../lib/hooks";
import type { RoundView } from "../../lib/types";
import { GameResultModal } from "../GameResultModal";
import { useToast } from "../Toast";
import { WinFx } from "./WinFx";
import { BalanceBar, StakePicker, useRound, wait, type GameProps } from "./shared";

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];

function PlayingCard({ id, hidden, index, motionOn }: { id?: number; hidden?: boolean; index: number; motionOn: boolean }) {
  const suit = id === undefined ? 0 : Math.floor(id / 13) % 4;
  const red = suit === 1 || suit === 2;
  const label = hidden || id === undefined ? "hidden card" : `${RANKS[id % 13]} ${["spades", "hearts", "diamonds", "clubs"][suit]}`;
  return (
    <motion.div
      initial={motionOn ? { y: -40, opacity: 0, rotate: -8 } : false} animate={{ y: 0, opacity: 1, rotate: 0 }}
      transition={{ delay: motionOn ? index * 0.12 : 0, type: "spring", stiffness: 260, damping: 22 }}
      className={`pcard ${hidden ? "back" : red ? "red" : ""}`} role="img" aria-label={label}
    >
      {!hidden && id !== undefined && (<><span className="corner">{RANKS[id % 13]}<span style={{ fontSize: ".85rem" }}>{SUITS[suit]}</span></span><span className="pip">{SUITS[suit]}</span></>)}
    </motion.div>
  );
}

interface BjView {
  player: number[]; dealer: number[]; dealerHiddenCards: number; playerTotal: number; playerSoft: boolean; dealerTotal: number | null;
  wagered: number; doubled: boolean; phase: "PLAYER" | "DONE"; result: string | null; canDouble: boolean;
}

export default function BlackjackGame({ game }: GameProps) {
  const { t, n } = useI18n();
  const m = useMotion();
  const { setBalance } = useAuth();
  const { toastError } = useToast();
  const cfg = game.rules;
  const { start, busy: starting } = useRound(game.slug);
  const [stake, setStake] = useState<number>(cfg.stakeSteps[1] ?? cfg.stakeSteps[0]);
  const [round, setRound] = useState<RoundView<BjView> | null>(null);
  const [acting, setActing] = useState(false);
  const [open, setOpen] = useState(false);
  const [cel, setCel] = useState(false);

  // Lanjutkan ronde yang masih berjalan (mis. setelah muat ulang halaman).
  useEffect(() => {
    api.get<RoundView<BjView> | null>(`/games/${game.slug}/active`).then((r) => r && setRound(r)).catch(() => undefined);
  }, [game.slug]);

  // Ronde selesai: kemenangan nyata (payout > total taruhan, termasuk double) dirayakan dulu; push/kalah langsung ke hasil.
  const finish = useCallback(async (r: RoundView<BjView>) => {
    if (r.payout > (r.view?.wagered ?? r.stake) && !m.reduced) { setCel(true); await wait(r.payout / (r.view?.wagered ?? r.stake) >= 25 ? 3200 : 2400); setCel(false); }
    setOpen(true);
  }, [m.reduced]);

  const deal = async () => {
    const r = await start({ stake });
    if (!r) return;
    setRound(r as RoundView<BjView>);
    if (r.status === "COMPLETED") void finish(r as RoundView<BjView>);
  };

  const act = useCallback(async (type: "hit" | "stand" | "double") => {
    if (!round || acting) return;
    setActing(true);
    try {
      const r = await api.post<RoundView<BjView>>(`/sessions/${round.sessionId}/actions`, { clientActionId: newRequestId(), expectedSeq: round.seq, action: { type } });
      setRound(r); setBalance(r.balance);
      if (r.status === "COMPLETED") void finish(r);
    } catch (e) {
      toastError(e);
      if (e instanceof ApiError && e.code === "STALE_ACTION") api.get<RoundView<BjView>>(`/sessions/${round.sessionId}`).then(setRound).catch(() => undefined);
    } finally { setActing(false); }
  }, [round, acting, setBalance, toastError, finish]);

  const v = round?.view;
  const active = round?.status === "ACTIVE";
  const done = round?.status === "COMPLETED";

  return (
    <div className="grid gap-4">
      <BalanceBar />
      <div className="game-stage">
        <div className="slot-title" aria-hidden="true">{t("blackjack.stageTitle")}</div>
        {cel && round && <WinFx key={round.sessionId} payout={round.payout} stake={round.view?.wagered ?? round.stake} reduced={m.reduced} fmt={n}
          label={{ win: t("slots.tierWin"), big: t("slots.tierBig"), mega: t("slots.tierMega") }} />}
        <div className="grid gap-6">
          <section aria-label={t("blackjack.dealer")}>
            <div className="mb-2 flex items-center justify-between text-sm text-emerald-100/80">
              <span className="font-semibold">{t("blackjack.dealer")}</span>
              <span className="num">{v ? (v.dealerTotal ?? "?") : "—"}</span>
            </div>
            <div className="flex min-h-[108px] gap-2">
              {v ? (<><AnimatePresence>{v.dealer.map((c, i) => <PlayingCard key={`d${i}-${c}`} id={c} index={i} motionOn={m.full} />)}</AnimatePresence>
                {Array.from({ length: v.dealerHiddenCards }, (_, i) => <PlayingCard key={`h${i}`} hidden index={1} motionOn={m.full} />)}</>)
                : <p className="self-center text-sm text-emerald-100/60">{t("blackjack.placeStake")}</p>}
            </div>
          </section>
          <section aria-label={t("blackjack.player")}>
            <div className="mb-2 flex items-center justify-between text-sm text-emerald-100/80">
              <span className="font-semibold">{t("blackjack.player")}</span>
              <span className="num" aria-live="polite">{v ? `${v.playerTotal}${v.playerSoft && v.playerTotal < 21 ? ` (${t("blackjack.soft")})` : ""}` : "—"}</span>
            </div>
            <div className="flex min-h-[108px] flex-wrap gap-2">
              {v?.player.map((c, i) => <PlayingCard key={`p${i}-${c}`} id={c} index={i + 2} motionOn={m.full} />)}
            </div>
          </section>
        </div>
        <p className="mt-4 text-center text-sm text-emerald-100/80" aria-live="polite">
          {active ? t("blackjack.yourTurn", { n: n(v!.wagered) }) : done && v?.result ? t(`blackjack.results.${v.result}`) : t("blackjack.ready")}
        </p>
      </div>

      <div className="card grid gap-4">
        {active ? (
          <div className="grid grid-cols-3 gap-2">
            <button className="btn btn-primary btn-lg" disabled={acting} onClick={() => act("hit")}><Plus size={18} />{t("blackjack.hit")}</button>
            <button className="btn btn-secondary btn-lg" disabled={acting} onClick={() => act("stand")}><Hand size={18} />{t("blackjack.stand")}</button>
            <button className="btn btn-gold btn-lg" disabled={acting || !v?.canDouble} onClick={() => act("double")} title={t("blackjack.doubleHint")}><Layers2 size={18} />{t("blackjack.double")}</button>
          </div>
        ) : (
          <>
            <div>
              <p className="mb-2 text-sm font-semibold">{t("game.stake")}</p>
              <StakePicker steps={cfg.stakeSteps} value={stake} onChange={setStake} disabled={starting || cel} label={t("game.stake")} />
            </div>
            <button className="btn btn-primary btn-lg" disabled={starting || cel} onClick={deal}><Play size={18} />{t("blackjack.deal")} · {n(stake)}</button>
          </>
        )}
        <p className="text-xs text-faint">{t("blackjack.serverNote")}</p>
      </div>

      {done && round && v && (
        <GameResultModal open={open} onClose={() => setOpen(false)} onAgain={() => { setOpen(false); setRound(null); }} title={t(`blackjack.results.${v.result}`)} stake={round.stake} payout={round.payout}>
          <p className="text-center text-sm text-muted">{t("blackjack.totals", { p: v.playerTotal, d: v.dealerTotal ?? 0 })}</p>
        </GameResultModal>
      )}
    </div>
  );
}
