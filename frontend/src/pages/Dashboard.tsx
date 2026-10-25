import { useState } from "react";
import { Link } from "react-router-dom";
import { Compass, Gift, Timer } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useAuth, type Me } from "../auth/AuthProvider";
import { useI18n } from "../i18n";
import type { HistoryItem, Mission, Recommendation } from "../lib/types";
import { GameCard, GameGrid } from "../components/GameCard";
import { GameHistoryTable } from "../components/GameHistoryTable";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { EmptyState } from "../components/EmptyState";
import { ProgressBar, RewardBadge } from "../components/MissionCard";
import { fmtDuration, usePlaySession } from "../components/SessionReminder";
import { useToast } from "../components/Toast";
import { VirtualWalletCard } from "../components/VirtualWalletCard";
import { Disclosure } from "../components/Layout";
import { Modal, PageHeader } from "../components/ui";

interface Dash {
  me: Me;
  daily: { amount: number; claimedToday: number; maxPerDay: number; canClaim: boolean; nextAt: string };
  recommendations: Recommendation[];
  recent: (HistoryItem & { outcome?: unknown })[];
  responsible: { todaySeconds: number; dailyLimitMinutes: number | null; reminderMinutes: number };
}

export default function Dashboard() {
  const { t, tl, n } = useI18n();
  const { me, setBalance, refresh } = useAuth();
  const { toast, toastError } = useToast();
  const { refresh: refreshSession } = usePlaySession();
  const dash = useApi(() => api.get<Dash>("/me/dashboard"));
  const missions = useApi(() => api.get<Mission[]>("/missions"));
  const history = useApi(() => api.get<{ items: HistoryItem[] }>("/history?limit=5"));
  const [tour, setTour] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);

  if (!me) return null;
  const claim = async () => {
    setClaiming(true);
    try {
      const r = await api.post<{ balance: number; amount: number }>("/wallet/daily-claim");
      setBalance(r.balance);
      toast(t("wallet.dailyClaimed", { n: n(r.amount) }));
      await dash.reload();
    } catch (e) { toastError(e); } finally { setClaiming(false); }
  };
  const finishTour = async () => {
    setTour(null);
    try { await api.post("/me/tutorial"); await refresh(); await missions.reload(); toast(t("dashboard.tourDone")); } catch (e) { toastError(e); }
  };

  const d = dash.data;
  const open = (missions.data ?? []).filter((m) => !m.claimed).slice(0, 3);
  const lv = me.level;

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow={t("nav.dashboard")} title={t("dashboard.hello", { name: me.profile.displayName })} subtitle={t("dashboard.subtitle")} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <VirtualWalletCard balance={me.balance}>
            <div className="w-full sm:w-auto sm:text-right">
              {d?.daily.canClaim ? (
                <button className="btn btn-gold w-full sm:w-auto" disabled={claiming} onClick={claim}><Gift size={16} />{t("wallet.claimDaily", { n: n(d.daily.amount) })}</button>
              ) : d ? <p className="text-xs text-muted sm:max-w-[10rem]">{t("wallet.dailyDone")}</p> : null}
            </div>
          </VirtualWalletCard>
        </div>
        <div className="card">
          <p className="eyebrow">{t("dashboard.progress")}</p>
          <p className="mt-1 font-display text-2xl font-extrabold">{t("common.level")} {lv.level}</p>
          <div className="mt-3"><ProgressBar value={Math.round(lv.progress * 100)} max={100} label={t("dashboard.progress")} /></div>
          <p className="num mt-1.5 text-xs text-faint">{n(lv.xp)} / {n(lv.nextXp)} XP</p>
          {d && <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><Timer size={14} />{t("dashboard.todayPlay", { time: fmtDuration(d.responsible.todaySeconds) })}</p>}
        </div>
      </div>

      {!me.preferences.tutorialDone && (
        <div className="card card-glow flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3"><Compass className="mt-0.5 text-brand-400" /><div><p className="font-bold">{t("dashboard.tourTitle")}</p><p className="text-sm text-muted">{t("dashboard.tourText")}</p></div></div>
          <button className="btn btn-primary" onClick={() => setTour(1)}>{t("dashboard.tourStart")}</button>
        </div>
      )}

      <section aria-labelledby="rec">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 id="rec" className="text-xl font-extrabold">{t("dashboard.forYou")}</h2>
          <p className="text-xs text-faint">{me.preferences.personalizationEnabled ? <>{t("dashboard.recNote")} <Link className="underline" to="/profile">{t("dashboard.recManage")}</Link></> : <>{t("dashboard.recOff")} <Link className="underline" to="/profile">{t("dashboard.recManage")}</Link></>}</p>
        </div>
        {dash.loading ? <LoadingSkeleton rows={1} height={220} /> : d && (
          <GameGrid>
            {d.recommendations.map((r) => (
              <GameCard key={r.slug} authed game={{ slug: r.slug, category: r.category as any, name: r.name, description: r.description }}
                reason={r.reason.key === "rec.default" ? undefined : t(r.reason.key, { ...r.reason.params, category: r.reason.params.category ? t(`games.categories.${r.reason.params.category}`) : "", tag: r.reason.params.tag ? t(`rec.tags.${r.reason.params.tag}`) : "" })} />
            ))}
          </GameGrid>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card" aria-labelledby="ms">
          <div className="mb-4 flex items-center justify-between"><h2 id="ms" className="text-lg font-bold">{t("dashboard.missionsTitle")}</h2><Link to="/missions" className="btn btn-ghost btn-sm">{t("dashboard.seeAll")}</Link></div>
          {missions.loading ? <LoadingSkeleton rows={2} /> : open.length === 0 ? <p className="text-sm text-muted">{t("dashboard.allMissionsDone")}</p> : (
            <ul className="grid gap-4">
              {open.map((m) => (
                <li key={m.id + m.periodKey}>
                  <div className="mb-1.5 flex items-center justify-between gap-2"><p className="text-sm font-semibold">{tl(m.title)}</p>{m.rewardCoins > 0 && <RewardBadge coins={m.rewardCoins} />}</div>
                  <ProgressBar value={m.progress} max={m.target} label={tl(m.title)} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="rc">
          <div className="mb-4 flex items-center justify-between"><h2 id="rc" className="text-lg font-bold">{t("dashboard.recentTitle")}</h2><Link to="/history" className="btn btn-ghost btn-sm">{t("dashboard.seeAll")}</Link></div>
          {history.loading ? <LoadingSkeleton rows={2} /> : !history.data?.items.length ? (
            <EmptyState title={t("history.emptyTitle")} text={t("history.emptyText")} />
          ) : <GameHistoryTable items={history.data.items} />}
        </section>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4"><Disclosure /></div>

      <Modal open={tour !== null} onClose={() => setTour(null)} title={t(`tour.s${tour ?? 1}.title`)}
        footer={<>
          {tour !== null && tour > 1 && <button className="btn btn-secondary" onClick={() => setTour(tour - 1)}>{t("common.back")}</button>}
          {tour !== null && tour < 4 ? <button className="btn btn-primary" onClick={() => setTour(tour + 1)}>{t("common.next")}</button> : <button className="btn btn-gold" onClick={finishTour}>{t("tour.finish")}</button>}
        </>}>
        <p className="text-sm text-muted">{t(`tour.s${tour ?? 1}.body`)}</p>
        <p className="num mt-4 text-xs text-faint">{tour ?? 1}/4</p>
      </Modal>
    </div>
  );
}
