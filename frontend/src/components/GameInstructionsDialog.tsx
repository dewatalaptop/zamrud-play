import { useEffect } from "react";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { useI18n } from "../i18n";
import type { GameInfo } from "../lib/types";
import { SymbolIcon } from "./games/art";
import { Modal } from "./ui";

/** Isi aturan game: teks terjemahan + tabel pembayaran yang dibaca langsung dari konfigurasi server aktif. */
export function GameRules({ game }: { game: GameInfo }) {
  const { t, n } = useI18n();
  const r = game.rules;
  const stakes = <p className="text-sm text-muted">{t("game.stakeRange", { min: n(r.minStake), max: n(r.maxStake) })}</p>;
  return (
    <div className="grid gap-4 text-sm">
      <p className="text-muted">{t(`rules.${game.slug}.intro`)}</p>
      <ul className="grid list-disc gap-1.5 pl-5 text-muted">
        {["1", "2", "3", "4"].map((k) => { const v = t(`rules.${game.slug}.p${k}`); return v.startsWith("rules.") ? null : <li key={k}>{v}</li>; })}
      </ul>
      {stakes}
      {game.slug === "virtual-slots" && (
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-left text-sm">
            <caption className="mb-2 text-left font-semibold">{t("slots.paytable")}</caption>
            <thead className="text-xs uppercase text-faint"><tr><th className="py-1.5">{t("slots.symbol")}</th><th>{t("slots.chance")}</th><th className="text-right">3×</th><th className="text-right">2×</th></tr></thead>
            <tbody>
              {r.symbols.map((s: any) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="py-1.5"><span className="inline-flex items-center gap-2"><SymbolIcon id={s.id} size={28} />{t(`slots.symbols.${s.id}`)}</span></td>
                  <td className="num text-muted">{s.chancePercent}%</td><td className="num text-right">{s.three}×</td><td className="num text-right">{s.two ? `${s.two}×` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-faint">{t("slots.rtpNote", { rtp: r.rtp.percent })}</p>
        </div>
      )}
      {game.slug === "euro-roulette" && (
        <table className="w-full text-left text-sm">
          <caption className="mb-2 text-left font-semibold">{t("roulette.payouts")}</caption>
          <thead className="text-xs uppercase text-faint"><tr><th className="py-1.5">{t("roulette.betType")}</th><th className="text-right">{t("roulette.pockets")}</th><th className="text-right">{t("roulette.returns")}</th></tr></thead>
          <tbody>
            {r.kinds.map((k: any) => (
              <tr key={k.kind} className="border-t border-line"><td className="py-1.5">{t(`roulette.kinds.${k.kind}`)}</td><td className="num text-right text-muted">{k.winningPockets}/37</td><td className="num text-right">{k.multiplier}×</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {game.slug === "dice-duel" && <p className="rounded-2xl bg-surface-2 p-3 text-muted">{t("dice.formula", { num: r.payoutNumerator, sides: r.sides })}</p>}
      {game.slug === "blackjack-21" && <p className="rounded-2xl bg-surface-2 p-3 text-muted">{t("blackjack.payoutRules", { bj: r.blackjackPays, decks: r.decks })}</p>}
      <p className="rounded-2xl border border-line p-3 text-xs text-muted">{t("rules.independent")}</p>
    </div>
  );
}

export function GameInstructionsDialog({ game, open, onClose }: { game: GameInfo; open: boolean; onClose: () => void }) {
  const { t, tl } = useI18n();
  const { me } = useAuth();
  useEffect(() => {
    // Membuka aturan dihitung untuk misi "baca aturan game" (hanya bila login).
    if (open && me) void api.post(`/games/${game.slug}/rules-viewed`).catch(() => undefined);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={open} onClose={onClose} title={`${t("game.rules")} — ${tl(game.name)}`} wide footer={<button className="btn btn-primary" onClick={onClose}>{t("game.understood")}</button>}>
      <GameRules game={game} />
    </Modal>
  );
}
