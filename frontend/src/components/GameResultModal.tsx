import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { useI18n } from "../i18n";
import { signed } from "../lib/outcome";
import { CoinIcon, Modal } from "./ui";

/** Hasil ronde: bahasa netral, menampilkan perubahan saldo virtual (bukan "menang uang"). */
export function GameResultModal({ open, onClose, onAgain, title, stake, payout, children }: {
  open: boolean; onClose: () => void; onAgain?: () => void; title: string; stake: number; payout: number; children?: ReactNode;
}) {
  const { t, n } = useI18n();
  const net = payout - stake;
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>{t("common.close")}</button>
        {onAgain && <button className="btn btn-primary" onClick={onAgain}><RotateCcw size={16} />{t("game.playAgain")}</button>}
      </>}>
      <div aria-live="polite">
        {children}
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-surface-2 p-3"><dt className="text-xs text-faint">{t("history.stake")}</dt><dd className="num mt-1 font-bold">{n(stake)}</dd></div>
          <div className="rounded-2xl bg-surface-2 p-3"><dt className="text-xs text-faint">{t("game.returned")}</dt><dd className="num mt-1 font-bold">{n(payout)}</dd></div>
          <div className={`rounded-2xl p-3 ${net > 0 ? "bg-[var(--success-bg)]" : "bg-surface-2"}`}><dt className="text-xs text-faint">{t("stats.netChange")}</dt><dd className="num mt-1 font-bold">{signed(net, n)}</dd></div>
        </dl>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted"><CoinIcon size={14} />{t("disclosure.short")}</p>
      </div>
    </Modal>
  );
}
