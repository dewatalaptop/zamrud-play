import { AlertTriangle, BarChart3, Clock, Coins, Gamepad2, Target, TrendingUp, Users } from "lucide-react";
import { api } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useI18n } from "../../i18n";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import { StatisticsChart } from "../../components/StatisticsChart";
import { PageHeader, Stat } from "../../components/ui";
import { fmtDuration } from "../../components/SessionReminder";

export interface Analytics {
  rangeDays: number; registeredUsers: number; newUsers: number; dailyActiveUsers: number; weeklyActiveUsers: number;
  sessionsStarted: number; completedSessions: number; completionRate: number | null; avgSessionSeconds: number | null; missionCompletions: number;
  coins: { issued: number; staked: number; paidOut: number; byType: { type: string; total: number; count: number }[] };
  requests: number; serverErrors: number; errorRate: number | null;
  byCategory: { category: string; rounds: number }[];
  byGame: { slug: string; name: { id: string; en: string }; started: number; completed: number; players: number; completionRate: number | null }[];
  rounds: { day: string; rounds: number }[]; signups: { day: string; signups: number }[];
}
export const useAnalytics = (days: number) => useApi(() => api.get<Analytics>(`/admin/analytics?days=${days}`), [days]);

export default function Overview() {
  const { t, n, tl } = useI18n();
  const { data: a, loading } = useAnalytics(30);
  const eco = useApi(() => api.get<{ inconsistencies: unknown[] }>("/admin/economy"));
  if (loading || !a) return <LoadingSkeleton rows={4} height={100} />;
  const empty = a.completedSessions === 0;
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t("admin.title")} title={t("admin.overview.title")} subtitle={t("admin.overview.subtitle", { days: a.rangeDays })} />
      {eco.data && eco.data.inconsistencies.length > 0 && (
        <div role="alert" className="flex items-center gap-3 rounded-2xl border border-[var(--error-text)]/40 bg-[var(--error-bg)] p-4 text-sm text-err"><AlertTriangle size={20} />{t("admin.overview.inconsistency", { n: eco.data.inconsistencies.length })}</div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<Users size={14} />} label={t("admin.m.registered")} value={n(a.registeredUsers)} hint={t("admin.m.newUsers", { n: a.newUsers })} />
        <Stat icon={<TrendingUp size={14} />} label={t("admin.m.dau")} value={n(a.dailyActiveUsers)} hint={t("admin.m.wau", { n: a.weeklyActiveUsers })} />
        <Stat icon={<Gamepad2 size={14} />} label={t("admin.m.completed")} value={n(a.completedSessions)} hint={a.completionRate === null ? undefined : t("admin.m.completionRate", { n: a.completionRate })} />
        <Stat icon={<Clock size={14} />} label={t("admin.m.avgSession")} value={a.avgSessionSeconds === null ? "—" : fmtDuration(a.avgSessionSeconds)} />
        <Stat icon={<Target size={14} />} label={t("admin.m.missions")} value={n(a.missionCompletions)} />
        <Stat icon={<Coins size={14} />} label={t("admin.m.issued")} value={n(a.coins.issued)} hint={t("admin.m.issuedHint")} />
        <Stat icon={<Coins size={14} />} label={t("admin.m.staked")} value={n(a.coins.staked)} hint={t("admin.m.paidOut", { n: n(a.coins.paidOut) })} />
        <Stat icon={<AlertTriangle size={14} />} label={t("admin.m.errorRate")} value={a.errorRate === null ? "—" : `${a.errorRate}%`} hint={t("admin.m.requests", { n: n(a.requests), e: n(a.serverErrors) })} />
      </div>
      {empty ? (
        <div className="card"><EmptyState icon={<BarChart3 />} title={t("admin.empty.title")} text={t("admin.empty.text")} /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card"><StatisticsChart title={t("admin.charts.categories")} type="donut" data={a.byCategory.map((c) => ({ name: t(`games.categories.${c.category}`), value: c.rounds }))} /></div>
          <div className="card"><StatisticsChart title={t("admin.charts.games")} type="bar" series2Label={t("admin.m.players")} data={a.byGame.map((g) => ({ name: tl(g.name), value: g.completed, value2: g.players }))} /></div>
        </div>
      )}
    </div>
  );
}
