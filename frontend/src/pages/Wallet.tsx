import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Gift, Ticket } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useAuth } from "../auth/AuthProvider";
import { useI18n } from "../i18n";
import type { GameInfo, Paged, Tx } from "../lib/types";
import { EmptyState } from "../components/EmptyState";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { useToast } from "../components/Toast";
import { VirtualWalletCard } from "../components/VirtualWalletCard";
import { Disclosure } from "../components/Layout";
import { PageHeader } from "../components/ui";
import { signed } from "../lib/outcome";

const TYPES = ["INITIAL_GRANT", "GAME_STAKE", "GAME_PAYOUT", "DAILY_REWARD", "MISSION_REWARD", "PROMO_REWARD", "ADMIN_ADJUSTMENT", "DEMO_RESET"];

export default function Wallet() {
  const { t, tl, n, date } = useI18n();
  const { me, setBalance } = useAuth();
  const { toast, toastError } = useToast();
  const status = useApi(() => api.get<{ balance: number; daily: { amount: number; canClaim: boolean; claimedToday: number; maxPerDay: number } }>("/wallet"));
  const games = useApi(() => api.get<GameInfo[]>("/games"));
  const [type, setType] = useState("");
  const [items, setItems] = useState<Tx[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (reset: boolean, cur?: string | null) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: "15" });
      if (type) q.set("type", type);
      if (!reset && cur) q.set("cursor", cur);
      const r = await api.get<Paged<Tx>>(`/wallet/transactions?${q}`);
      setItems((x) => (reset ? r.items : [...x, ...r.items]));
      setCursor(r.nextCursor);
    } catch (e) { toastError(e); } finally { setLoading(false); }
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(true); }, [load]);

  const claim = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ balance: number; amount: number }>("/wallet/daily-claim");
      setBalance(r.balance); toast(t("wallet.dailyClaimed", { n: n(r.amount) }));
      await Promise.all([status.reload(), load(true)]);
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  const redeem = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api.post<{ balance: number; amount: number }>("/wallet/promo", { code });
      setBalance(r.balance); setCode(""); toast(t("wallet.promoRedeemed", { n: n(r.amount) }));
      await load(true);
    } catch (err) { toastError(err); } finally { setBusy(false); }
  };

  const gameName = (slug?: string) => { const g = games.data?.find((x) => x.slug === slug); return g ? tl(g.name) : ""; };
  const describe = (x: Tx) => {
    const base = t(`tx.${x.type}`);
    if (x.type === "GAME_STAKE" || x.type === "GAME_PAYOUT") return `${base} · ${gameName(x.meta.game)}`;
    if (x.type === "PROMO_REWARD") return `${base} · ${x.meta.code ?? ""}`;
    if (x.type === "ADMIN_ADJUSTMENT" || x.type === "DEMO_RESET") return `${base}${x.note ? ` — ${x.note}` : ""}`;
    return base;
  };

  const d = status.data?.daily;
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t("nav.wallet")} title={t("wallet.title")} subtitle={t("wallet.subtitle")} />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <VirtualWalletCard balance={me?.balance ?? 0} />
        <div className="grid gap-4">
          <div className="card">
            <h2 className="flex items-center gap-2 font-bold"><Gift size={18} className="text-brand-400" />{t("wallet.dailyTitle")}</h2>
            <p className="mt-1 text-sm text-muted">{t("wallet.dailyText", { n: n(d?.amount ?? 0) })}</p>
            <button className="btn btn-gold mt-3" disabled={!d?.canClaim || busy} onClick={claim}>{d?.canClaim ? t("wallet.claimDaily", { n: n(d.amount) }) : t("wallet.dailyDone")}</button>
          </div>
          <form className="card" onSubmit={redeem}>
            <h2 className="flex items-center gap-2 font-bold"><Ticket size={18} className="text-brand-400" />{t("wallet.promoTitle")}</h2>
            <p className="mt-1 text-sm text-muted">{t("wallet.promoText")}</p>
            <div className="mt-3 flex gap-2"><label className="flex-1"><span className="sr-only">{t("wallet.promoCode")}</span><input className="input uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("wallet.promoCode")} maxLength={32} /></label><button className="btn btn-primary" disabled={busy || code.trim().length < 3}>{t("wallet.redeem")}</button></div>
          </form>
        </div>
      </div>

      <section className="card" aria-labelledby="tx">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="tx" className="text-lg font-bold">{t("wallet.history")}</h2>
          <label className="text-sm"><span className="sr-only">{t("wallet.filter")}</span>
            <select className="select !w-auto" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">{t("common.all")}</option>{TYPES.map((x) => <option key={x} value={x}>{t(`tx.${x}`)}</option>)}
            </select>
          </label>
        </div>
        {loading && !items.length ? <LoadingSkeleton rows={4} height={52} /> : !items.length ? <EmptyState art="data" title={t("wallet.emptyTitle")} text={t("wallet.emptyText")} /> : (
          <ul className="divide-y divide-line">
            {items.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{describe(x)}</p><p className="text-xs text-faint">{date(x.createdAt)}</p></div>
                <div className="text-right"><p className={`num font-bold ${x.amount > 0 ? "text-ok" : ""}`}>{signed(x.amount, n)}</p><p className="num text-xs text-faint">{t("wallet.balanceAfter")} {n(x.balanceAfter)}</p></div>
              </li>
            ))}
          </ul>
        )}
        {cursor && <div className="mt-4 text-center"><button className="btn btn-secondary btn-sm" disabled={loading} onClick={() => load(false, cursor)}>{t("common.loadMore")}</button></div>}
      </section>
      <div className="rounded-2xl border border-line bg-surface p-4"><Disclosure /><p className="mt-2 text-xs text-muted">{t("wallet.noTransfers")}</p></div>
    </div>
  );
}
