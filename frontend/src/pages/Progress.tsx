import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, Target } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useAuth } from "../auth/AuthProvider";
import { useI18n } from "../i18n";
import type { Achievement, GameInfo, HistoryItem, Mission, Paged } from "../lib/types";
import { AchievementBadge } from "../components/AchievementBadge";
import { EmptyState } from "../components/EmptyState";
import { GameHistoryTable } from "../components/GameHistoryTable";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { MissionCard, ProgressBar } from "../components/MissionCard";
import { useToast } from "../components/Toast";
import { PageHeader } from "../components/ui";

export function Missions() {
  const { t, n } = useI18n();
  const { setBalance, refresh } = useAuth();
  const { toast, toastError } = useToast();
  const { data, loading, reload } = useApi(() => api.get<Mission[]>("/missions"));
  const [busy, setBusy] = useState<string | null>(null);

  const claim = async (m: Mission) => {
    setBusy(m.id + m.periodKey);
    try {
      const r = await api.post<{ balance: number; amount: number }>(`/missions/${m.id}/claim`, { periodKey: m.periodKey });
      setBalance(r.balance);
      toast(r.amount > 0 ? t("missions.claimedToast", { n: n(r.amount) }) : t("missions.claimed"));
      await Promise.all([reload(), refresh()]);
    } catch (e) { toastError(e); await reload(); } finally { setBusy(null); }
  };
  const groups: Mission["period"][] = ["DAILY", "WEEKLY", "ONCE"];
  return (
    <div>
      <PageHeader eyebrow={t("nav.missions")} title={t("missions.title")} subtitle={t("missions.subtitle")} />
      {loading ? <LoadingSkeleton rows={3} height={150} /> : !data?.length ? <EmptyState icon={<Target />} title={t("missions.emptyTitle")} text={t("missions.emptyText")} /> : (
        <div className="grid gap-8">
          {groups.map((g) => {
            const list = data.filter((m) => m.period === g);
            if (!list.length) return null;
            return (
              <section key={g} aria-labelledby={`g-${g}`}>
                <h2 id={`g-${g}`} className="mb-3 text-lg font-bold">{t(`missions.groups.${g}`)}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((m) => <MissionCard key={m.id + m.periodKey} mission={m} busy={busy === m.id + m.periodKey} onClaim={claim} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <p className="mt-8 text-xs text-muted">{t("missions.policy")}</p>
    </div>
  );
}

export function Achievements() {
  const { t, n } = useI18n();
  const { me } = useAuth();
  const { data, loading } = useApi(() => api.get<Achievement[]>("/achievements"));
  const done = data?.filter((a) => a.unlockedAt).length ?? 0;
  return (
    <div>
      <PageHeader eyebrow={t("nav.achievements")} title={t("achievements.title")} subtitle={t("achievements.subtitle")} />
      {me && (
        <div className="card mb-6 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex items-center gap-3"><Award className="text-gold" size={32} /><div><p className="num font-display text-2xl font-extrabold">{done}/{data?.length ?? 0}</p><p className="text-xs text-faint">{t("achievements.unlockedCount")}</p></div></div>
          <div><p className="mb-1.5 text-sm font-semibold">{t("common.level")} {me.level.level} · <span className="num text-faint">{n(me.level.xp)} / {n(me.level.nextXp)} XP</span></p><ProgressBar value={Math.round(me.level.progress * 100)} max={100} label={t("dashboard.progress")} /></div>
        </div>
      )}
      {loading ? <LoadingSkeleton rows={2} height={180} /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{data?.map((a) => <AchievementBadge key={a.id} a={a} />)}</div>}
    </div>
  );
}

export function History() {
  const { t, tl } = useI18n();
  const { toastError } = useToast();
  const games = useApi(() => api.get<GameInfo[]>("/games"));
  const [game, setGame] = useState("");
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (reset: boolean, cur?: string | null) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: "15" });
      if (game) q.set("game", game);
      if (!reset && cur) q.set("cursor", cur);
      const r = await api.get<Paged<HistoryItem>>(`/history?${q}`);
      setItems((x) => (reset ? r.items : [...x, ...r.items])); setCursor(r.nextCursor);
    } catch (e) { toastError(e); } finally { setLoading(false); }
  }, [game]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(true); }, [load]);
  return (
    <div>
      <PageHeader eyebrow={t("nav.history")} title={t("history.title")} subtitle={t("history.subtitle")}
        actions={<label className="text-sm"><span className="sr-only">{t("history.filter")}</span><select className="select !w-auto" value={game} onChange={(e) => setGame(e.target.value)}><option value="">{t("common.all")}</option>{games.data?.map((g) => <option key={g.slug} value={g.slug}>{tl(g.name)}</option>)}</select></label>} />
      <div className="card">
        {loading && !items.length ? <LoadingSkeleton rows={4} height={52} /> : !items.length ? (
          <EmptyState title={t("history.emptyTitle")} text={t("history.emptyText")} action={<Link to="/games" className="btn btn-primary">{t("games.title")}</Link>} />
        ) : <GameHistoryTable items={items} />}
        {cursor && <div className="mt-4 text-center"><button className="btn btn-secondary btn-sm" disabled={loading} onClick={() => load(false, cursor)}>{t("common.loadMore")}</button></div>}
      </div>
      <p className="mt-4 text-xs text-muted">{t("history.neutral")}</p>
    </div>
  );
}
