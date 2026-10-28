import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Play } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useAuth } from "../auth/AuthProvider";
import { useI18n } from "../i18n";
import type { GameInfo } from "../lib/types";
import { GameArt } from "../components/games/art";
import { GameRules } from "../components/GameInstructionsDialog";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { EmptyState } from "../components/EmptyState";
import { Disclosure } from "../components/Layout";

export default function GameDetail() {
  const { slug = "" } = useParams();
  const { t, tl } = useI18n();
  const { me } = useAuth();
  const { data: g, loading, error } = useApi(() => api.get<GameInfo>(`/games/${slug}`), [slug]);

  useEffect(() => {
    if (me && g) {
      void api.post("/me/events", { type: "GAME_VIEWED", game: slug }).catch(() => undefined);
      void api.post(`/games/${slug}/rules-viewed`).catch(() => undefined); // halaman ini memuat aturan lengkap
    }
  }, [me?.id, g?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSkeleton rows={3} height={140} />;
  if (error || !g) return <EmptyState art="notfound" title={t("games.notFound")} action={<Link to="/games" className="btn btn-primary">{t("games.title")}</Link>} />;

  return (
    <article className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="grid gap-6">
        <div className="overflow-hidden rounded-3xl border border-line"><GameArt slug={g.slug} className="h-56 w-full sm:h-72" /></div>
        <div>
          <p className="eyebrow">{t(`games.categories.${g.category}`)} · {t(`games.difficulty.${g.difficulty}`)}</p>
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{tl(g.name)}</h1>
          <p className="mt-3 text-muted">{tl(g.description)}</p>
          <div className="mt-4 flex flex-wrap gap-2">{g.tags.map((x) => <span key={x} className="chip">{t(`rec.tags.${x}`)}</span>)}</div>
        </div>
        <section className="card" aria-labelledby="rules"><h2 id="rules" className="mb-4 text-lg font-bold">{t("game.rules")}</h2><GameRules game={g} /></section>
      </div>
      <aside className="grid content-start gap-4 lg:sticky lg:top-24 lg:self-start">
        <div className="card card-glow grid gap-3">
          <p className="text-sm text-muted">{t("game.virtualNote")}</p>
          <Link to={me ? `/play/${g.slug}` : "/register"} className="btn btn-primary btn-lg"><Play size={18} />{me ? t("games.play") : t("games.playFree")}</Link>
          <p className="text-xs text-faint">{t("game.configVersion", { v: g.configVersion })}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4"><Disclosure /></div>
      </aside>
    </article>
  );
}
