import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Coins, Gamepad2, Gift, Scale, Trophy } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useI18n } from "../i18n";
import { EmptyState } from "../components/EmptyState";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { StatisticsChart } from "../components/StatisticsChart";
import { PageHeader, Stat } from "../components/ui";
import { signed } from "../lib/outcome";
import { GameHistoryTable } from "../components/GameHistoryTable";
import type { HistoryItem } from "../lib/types";

interface Stats {
  totals: { gamesPlayed: number; coinsStaked: number; grossPayouts: number; netBalanceChange: number; coinsReceivedAsRewards: number };
  byCategory: { category: string; count: number }[];
  byGame: { slug: string; name: { id: string; en: string }; count: number; net: number }[];
  recent: (Omit<HistoryItem, "outcome" | "configVersion"> & { outcome?: unknown; configVersion?: number })[];
  sessionDurations: { day: string; minutes: number; rounds: number }[];
  achievements: { unlocked: number; total: number };
  level: { level: number; xp: number };
}

export default function Statistics() {
  const { t, tl, n } = useI18n();
  const { data, loading } = useApi(() => api.get<Stats>("/statistics"));
  useEffect(() => { void api.post("/statistics/view").catch(() => undefined); }, []);

  if (loading || !data) return <LoadingSkeleton rows={4} height={110} />;
  const s = data;
  if (s.totals.gamesPlayed === 0) {
    return (
      <div><PageHeader eyebrow={t("nav.statistics")} title={t("stats.title")} subtitle={t("stats.subtitle")} />
        <EmptyState icon={<BarChart3 />} title={t("stats.emptyTitle")} text={t("stats.emptyText")} action={<Link to="/games" className="btn btn-primary">{t("games.title")}</Link>} /></div>
    );
  }
  const earned = s.totals.grossPayouts + s.totals.coinsReceivedAsRewards;
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t("nav.statistics")} title={t("stats.title")} subtitle={t("stats.subtitle")} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat icon={<Gamepad2 size={14} />} label={t("stats.gamesPlayed")} value={n(s.totals.gamesPlayed)} />
        <Stat icon={<Coins size={14} />} label={t("stats.coinsEarned")} value={n(earned)} hint={t("stats.coinsEarnedHint")} />
        <Stat icon={<Coins size={14} />} label={t("stats.coinsSpent")} value={n(s.totals.coinsStaked)} hint={t("stats.coinsSpentHint")} />
        <Stat icon={<Scale size={14} />} label={t("stats.netChange")} value={signed(s.totals.netBalanceChange, n)} hint={t("stats.netHint")} />
        <Stat icon={<Gift size={14} />} label={t("stats.rewards")} value={n(s.totals.coinsReceivedAsRewards)} hint={t("stats.rewardsHint")} />
      </div>
      <div className="card text-sm text-muted">{t("stats.grossNote", { gross: n(s.totals.grossPayouts), net: signed(s.totals.netBalanceChange, n) })}</div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card"><StatisticsChart title={t("stats.byCategory")} type="donut" data={s.byCategory.map((c) => ({ name: t(`games.categories.${c.category}`), value: c.count }))} /></div>
        <div className="card"><StatisticsChart title={t("stats.favoriteGames")} type="bar" data={s.byGame.map((g) => ({ name: tl(g.name), value: g.count }))} /></div>
        <div className="card lg:col-span-2">
          {s.sessionDurations.length ? <StatisticsChart title={t("stats.durationTrend")} type="line" unit={t("stats.minutes")} series2Label={t("stats.rounds")} data={s.sessionDurations.map((d) => ({ name: d.day.slice(5), value: d.minutes, value2: d.rounds }))} />
            : <p className="text-sm text-muted">{t("stats.noDuration")}</p>}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card"><h2 className="mb-3 text-lg font-bold">{t("stats.recent")}</h2><GameHistoryTable items={s.recent.map((r) => ({ ...r, outcome: r.outcome, configVersion: r.configVersion ?? 1 }) as HistoryItem)} /></div>
        <div className="card self-start"><h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Trophy size={18} className="text-gold" />{t("stats.achievementProgress")}</h2><p className="num font-display text-3xl font-extrabold">{s.achievements.unlocked}/{s.achievements.total}</p><Link to="/achievements" className="btn btn-secondary btn-sm mt-3">{t("achievements.title")}</Link></div>
      </div>
    </div>
  );
}
