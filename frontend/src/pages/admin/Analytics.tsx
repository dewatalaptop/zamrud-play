import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { useI18n } from "../../i18n";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import { StatisticsChart } from "../../components/StatisticsChart";
import { AdminDataTable } from "../../components/admin/AdminDataTable";
import { PageHeader } from "../../components/ui";
import { useAnalytics } from "./Overview";

export default function AnalyticsPage() {
  const { t, n, tl } = useI18n();
  const [days, setDays] = useState(30);
  const { data: a, loading } = useAnalytics(days);
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t("admin.title")} title={t("admin.analytics.title")} subtitle={t("admin.analytics.subtitle")}
        actions={<div role="group" aria-label={t("admin.analytics.range")} className="flex gap-2">{[7, 30, 90].map((d) => <button key={d} className="bet-btn" aria-pressed={days === d} onClick={() => setDays(d)}>{t("admin.analytics.days", { n: d })}</button>)}</div>} />
      {loading || !a ? <LoadingSkeleton rows={3} height={240} /> : a.completedSessions === 0 && a.newUsers === 0 ? (
        <div className="card"><EmptyState icon={<BarChart3 />} title={t("admin.empty.title")} text={t("admin.empty.text")} /></div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card"><StatisticsChart title={t("admin.charts.roundsPerDay")} type="line" data={a.rounds.map((r) => ({ name: r.day.slice(5), value: r.rounds }))} /></div>
            <div className="card"><StatisticsChart title={t("admin.charts.signups")} type="bar" data={a.signups.map((r) => ({ name: r.day.slice(5), value: r.signups }))} /></div>
            <div className="card"><StatisticsChart title={t("admin.charts.categories")} type="donut" data={a.byCategory.map((c) => ({ name: t(`games.categories.${c.category}`), value: c.rounds }))} /></div>
            <div className="card"><StatisticsChart title={t("admin.charts.issuance")} type="bar" data={a.coins.byType.map((c) => ({ name: t(`tx.${c.type}`), value: Math.abs(c.total) }))} /></div>
          </div>
          <div className="card">
            <h2 className="mb-3 text-lg font-bold">{t("admin.analytics.popularity")}</h2>
            <AdminDataTable caption={t("admin.analytics.popularity")} emptyTitle={t("common.none")} rows={a.byGame.map((g) => ({ id: g.slug, ...g }))}
              cols={[
                { key: "name", header: t("common.name"), render: (g) => <span className="font-semibold">{tl(g.name)}</span> },
                { key: "started", header: t("admin.m.started"), align: "right", render: (g) => n(g.started) },
                { key: "completed", header: t("admin.m.completedCol"), align: "right", render: (g) => n(g.completed) },
                { key: "players", header: t("admin.m.players"), align: "right", render: (g) => n(g.players) },
                { key: "rate", header: t("admin.m.completionCol"), align: "right", render: (g) => (g.completionRate === null ? "—" : `${g.completionRate}%`) },
              ]} />
          </div>
          <p className="text-xs text-muted">{t("admin.analytics.privacy")}</p>
        </>
      )}
    </div>
  );
}
