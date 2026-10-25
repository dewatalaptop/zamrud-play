import { Link } from "react-router-dom";
import { Wallet } from "lucide-react";
import { useI18n } from "../i18n";
import { CoinIcon } from "./ui";

export function VirtualWalletCard({ balance, compact, children }: { balance: number; compact?: boolean; children?: React.ReactNode }) {
  const { t, n } = useI18n();
  if (compact) {
    return (
      <Link to="/wallet" className="chip !px-3 !py-1.5 !text-sm hover:border-brand-400 text-ink" aria-label={`${t("wallet.balance")}: ${n(balance)}`}>
        <CoinIcon size={16} /><span className="num font-bold">{n(balance)}</span>
      </Link>
    );
  }
  return (
    <section className="card card-glow relative overflow-hidden" aria-label={t("wallet.balance")}>
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/20 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-faint"><Wallet size={14} />{t("wallet.balance")}</p>
          <p className="mt-2 flex items-center gap-2.5 font-display text-4xl font-extrabold num"><CoinIcon size={32} />{n(balance)}</p>
          <p className="mt-1 text-xs text-muted">{t("wallet.virtualOnly")}</p>
        </div>
        {children}
      </div>
    </section>
  );
}
