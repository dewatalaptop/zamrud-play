import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useAuth } from "../auth/AuthProvider";
import { useI18n } from "../i18n";
import { CATEGORIES, type GameInfo } from "../lib/types";
import { GameCard, GameGrid } from "../components/GameCard";
import { GridSkeleton } from "../components/LoadingSkeleton";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/ui";
import { useToast } from "../components/Toast";
import { Disclosure } from "../components/Layout";

export default function Games() {
  const { t, tl } = useI18n();
  const { me } = useAuth();
  const { toastError } = useToast();
  const { data, loading, error, reload } = useApi(() => api.get<GameInfo[]>("/games"));
  const favs = useApi<string[]>(async () => (me ? api.get<string[]>("/me/favorites") : []), [me?.id]);
  const [cat, setCat] = useState<string>("ALL");
  const [q, setQ] = useState("");

  const list = useMemo(() => (data ?? []).filter((g) => (cat === "ALL" || g.category === cat) && (!q || tl(g.name).toLowerCase().includes(q.toLowerCase()))), [data, cat, q, tl]);

  const toggleFav = async (slug: string) => {
    const on = favs.data?.includes(slug);
    try {
      if (on) await api.del(`/me/favorites/${slug}`); else await api.put(`/me/favorites/${slug}`);
      await favs.reload();
    } catch (e) { toastError(e); }
  };

  return (
    <div>
      <PageHeader eyebrow={t("games.eyebrow")} title={t("games.title")} subtitle={t("games.subtitle")} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div role="group" aria-label={t("games.filterCategory")} className="flex flex-wrap gap-2">
          {["ALL", ...CATEGORIES].map((c) => (
            <button key={c} className="bet-btn" aria-pressed={cat === c} onClick={() => setCat(c)}>{c === "ALL" ? t("common.all") : t(`games.categories.${c}`)}</button>
          ))}
        </div>
        <label className="relative ml-auto w-full sm:w-64">
          <span className="sr-only">{t("common.search")}</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
          <input className="input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("games.searchPlaceholder")} />
        </label>
      </div>
      {loading ? <GridSkeleton /> : error ? (
        <EmptyState title={t("common.error")} action={<button className="btn btn-primary" onClick={reload}>{t("common.retry")}</button>} />
      ) : list.length === 0 ? <EmptyState title={t("games.empty")} /> : (
        <GameGrid>{list.map((g) => <GameCard key={g.slug} game={g} authed={!!me} favorite={favs.data?.includes(g.slug)} onFavorite={() => toggleFav(g.slug)} />)}</GameGrid>
      )}
      <div className="mt-8 rounded-2xl border border-line bg-surface p-4"><Disclosure /></div>
    </div>
  );
}
