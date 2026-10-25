import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useI18n } from "../../i18n";
import { AdminDataTable } from "../../components/admin/AdminDataTable";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import { useToast } from "../../components/Toast";
import { PageHeader } from "../../components/ui";
import { useAnalytics } from "./Overview";

interface Eco { startingBalance: number; dailyReward: number; dailyRewardMaxPerDay: number; xpPerRound: number; xpPerRoundDailyCap: number; xpPerMission: number; xpPerAchievement: number; }
interface Promo { id: string; code: string; rewardCoins: number; maxRedemptions: number; redeemed: number; expiresAt: string | null; active: boolean; }
const FIELDS: (keyof Eco)[] = ["startingBalance", "dailyReward", "dailyRewardMaxPerDay", "xpPerRound", "xpPerRoundDailyCap", "xpPerMission", "xpPerAchievement"];

export default function Economy() {
  const { t, n } = useI18n();
  const { toast, toastError } = useToast();
  const { data, loading, reload } = useApi(() => api.get<{ economy: Eco; inconsistencies: { userId: string; balance: number; ledgerSum: number }[]; promos: Promo[] }>("/admin/economy"));
  const an = useAnalytics(30);
  const [eco, setEco] = useState<Eco | null>(null);
  const [reason, setReason] = useState("");
  const [promo, setPromo] = useState({ code: "", rewardCoins: "500", maxRedemptions: "100" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setEco(data.economy); }, [data]);
  if (loading || !data || !eco) return <LoadingSkeleton rows={3} height={160} />;

  const save = async () => {
    setBusy(true);
    try { await api.put("/admin/economy", { reason, economy: eco }); toast(t("common.saved")); setReason(""); await reload(); } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  const addPromo = async () => {
    setBusy(true);
    try { await api.post("/admin/promos", { code: promo.code, rewardCoins: Number(promo.rewardCoins), maxRedemptions: Number(promo.maxRedemptions), expiresAt: null }); toast(t("common.saved")); setPromo({ code: "", rewardCoins: "500", maxRedemptions: "100" }); await reload(); } catch (e) { toastError(e); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t("admin.title")} title={t("admin.economy.title")} subtitle={t("admin.economy.subtitle")} />
      <section className="card grid gap-4" aria-labelledby="cfg">
        <h2 id="cfg" className="text-lg font-bold">{t("admin.economy.config")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FIELDS.map((k) => (
            <label key={k} className="grid gap-1.5 text-sm font-semibold">{t(`admin.economy.f_${k}`)}
              <input className="input" type="number" min={0} value={eco[k]} onChange={(e) => setEco({ ...eco, [k]: Number(e.target.value) })} /></label>
          ))}
        </div>
        <label className="grid gap-1.5 text-sm font-semibold">{t("admin.users.reasonRequired")}<input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <div><button className="btn btn-primary" disabled={busy || reason.trim().length < 5} onClick={save}>{t("common.save")}</button></div>
      </section>

      <section className="card grid gap-3" aria-labelledby="iss">
        <h2 id="iss" className="text-lg font-bold">{t("admin.economy.issuance")}</h2>
        {an.data && (
          <dl className="grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-2xl bg-surface-2 p-3"><dt className="text-faint">{t("admin.m.issued")}</dt><dd className="num text-xl font-bold">{n(an.data.coins.issued)}</dd></div>
            <div className="rounded-2xl bg-surface-2 p-3"><dt className="text-faint">{t("admin.m.staked")}</dt><dd className="num text-xl font-bold">{n(an.data.coins.staked)}</dd></div>
            <div className="rounded-2xl bg-surface-2 p-3"><dt className="text-faint">{t("admin.m.paidOutLabel")}</dt><dd className="num text-xl font-bold">{n(an.data.coins.paidOut)}</dd></div>
          </dl>
        )}
        <p className="text-xs text-muted">{t("admin.economy.issuanceNote")}</p>
      </section>

      <section className="card grid gap-3" aria-labelledby="rec">
        <h2 id="rec" className="text-lg font-bold">{t("admin.economy.reconcile")}</h2>
        {data.inconsistencies.length === 0 ? <p className="flex items-center gap-2 text-sm text-ok"><CheckCircle2 size={18} />{t("admin.economy.reconcileOk")}</p> : (
          <div role="alert"><p className="mb-2 flex items-center gap-2 text-sm text-err"><AlertTriangle size={18} />{t("admin.economy.reconcileBad", { n: data.inconsistencies.length })}</p>
            <ul className="grid gap-1 text-xs">{data.inconsistencies.map((i) => <li key={i.userId} className="num rounded-lg bg-[var(--error-bg)] px-3 py-2">{i.userId} — {t("wallet.balance")} {i.balance} ≠ ledger {i.ledgerSum}</li>)}</ul></div>
        )}
      </section>

      <section className="card grid gap-4" aria-labelledby="pr">
        <h2 id="pr" className="text-lg font-bold">{t("admin.economy.promos")}</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1.5 text-sm font-semibold">{t("wallet.promoCode")}<input className="input uppercase" value={promo.code} onChange={(e) => setPromo({ ...promo, code: e.target.value })} maxLength={24} /></label>
          <label className="grid gap-1.5 text-sm font-semibold">{t("admin.economy.reward")}<input className="input" type="number" min={1} value={promo.rewardCoins} onChange={(e) => setPromo({ ...promo, rewardCoins: e.target.value })} /></label>
          <label className="grid gap-1.5 text-sm font-semibold">{t("admin.economy.quota")}<input className="input" type="number" min={1} value={promo.maxRedemptions} onChange={(e) => setPromo({ ...promo, maxRedemptions: e.target.value })} /></label>
          <button className="btn btn-primary" disabled={busy || !/^[A-Za-z0-9-]{4,24}$/.test(promo.code)} onClick={addPromo}>{t("common.create")}</button>
        </div>
        <AdminDataTable<Promo> caption={t("admin.economy.promos")} rows={data.promos} emptyTitle={t("common.none")}
          cols={[
            { key: "code", header: t("wallet.promoCode"), render: (p) => <span className="font-mono font-semibold">{p.code}</span> },
            { key: "reward", header: t("admin.economy.reward"), align: "right", render: (p) => n(p.rewardCoins) },
            { key: "used", header: t("admin.economy.used"), align: "right", render: (p) => `${p.redeemed}/${p.maxRedemptions}` },
            { key: "active", header: t("common.status"), render: (p) => <button className={`btn btn-sm ${p.active ? "btn-secondary" : "btn-primary"}`} onClick={async () => { try { await api.post(`/admin/promos/${p.id}/active`, { active: !p.active }); await reload(); } catch (e) { toastError(e); } }}>{p.active ? t("common.active") : t("common.inactive")}</button> },
          ]} />
      </section>
    </div>
  );
}
