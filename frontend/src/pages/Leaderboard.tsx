import { Award, Trophy } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useI18n } from "../i18n";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { EmptyState } from "../components/EmptyState";
import { PageHeader, UserAvatar } from "../components/ui";
import { ButtonLink } from "../components/ui";

interface Row { rank: number; displayName: string; avatarColor: string; avatarIcon: string; xp: number; level: number; badges: number; }

export default function Leaderboard() {
  const { t, n } = useI18n();
  const { data, loading } = useApi(() => api.get<Row[]>("/leaderboard"));
  return (
    <div>
      <PageHeader eyebrow={t("leaderboard.eyebrow")} title={t("leaderboard.title")} subtitle={t("leaderboard.subtitle")} />
      {loading ? <LoadingSkeleton rows={5} height={64} /> : !data?.length ? (
        <EmptyState art="rank" icon={<Trophy />} title={t("leaderboard.emptyTitle")} text={t("leaderboard.emptyText")} action={<ButtonLink to="/register">{t("landing.cta")}</ButtonLink>} />
      ) : (
        <ol className="grid gap-3">
          {data.map((r) => (
            <li key={r.rank} className={`card flex items-center gap-4 !p-4 ${r.rank <= 3 ? "border-[hsl(43_80%_45%/.5)]" : ""}`}>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-lg font-extrabold ${r.rank === 1 ? "bg-gold text-black" : "bg-surface-2"}`} aria-label={`#${r.rank}`}>{r.rank}</span>
              <UserAvatar name={r.displayName} color={r.avatarColor} icon={r.avatarIcon} />
              <div className="min-w-0 flex-1"><p className="truncate font-bold">{r.displayName}</p><p className="text-xs text-faint">{t("common.level")} {r.level}</p></div>
              <span className="chip hidden sm:inline-flex"><Award size={14} />{r.badges}</span>
              <p className="num text-right font-display text-xl font-extrabold">{n(r.xp)}<span className="ml-1 text-xs font-semibold text-faint">XP</span></p>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-6 text-xs text-muted">{t("leaderboard.note")}</p>
    </div>
  );
}
