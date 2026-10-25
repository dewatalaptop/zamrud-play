import { Link } from "react-router-dom";
import { Heart, Info, Play } from "lucide-react";
import { useI18n } from "../i18n";
import type { GameInfo } from "../lib/types";
import { GameArt } from "./games/art";

export function GameCard({ game, reason, favorite, onFavorite, authed }: {
  game: Pick<GameInfo, "slug" | "category" | "name" | "description"> & { difficulty?: string };
  reason?: string; favorite?: boolean; onFavorite?: () => void; authed?: boolean;
}) {
  const { t, tl } = useI18n();
  return (
    <article className="card card-interactive group flex flex-col !p-0 overflow-hidden">
      <div className="relative">
        <GameArt slug={game.slug} className="h-40 w-full" />
        <span className="chip absolute left-3 top-3 !bg-black/40 backdrop-blur">{t(`games.categories.${game.category}`)}</span>
        {authed && onFavorite && (
          <button onClick={onFavorite} aria-pressed={!!favorite} aria-label={favorite ? t("games.unfavorite") : t("games.favorite")}
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60">
            <Heart size={18} className={favorite ? "fill-rose-500 text-rose-500" : ""} />
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="text-lg font-bold">{tl(game.name)}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted">{tl(game.description)}</p>
        </div>
        {reason && <p className="flex items-start gap-1.5 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700"><Info size={14} className="mt-px shrink-0" aria-hidden="true" />{reason}</p>}
        <div className="mt-auto flex gap-2 pt-1">
          <Link to={authed ? `/play/${game.slug}` : "/register"} className="btn btn-primary btn-sm flex-1"><Play size={15} />{authed ? t("games.play") : t("games.playFree")}</Link>
          <Link to={`/games/${game.slug}`} className="btn btn-secondary btn-sm">{t("games.details")}</Link>
        </div>
      </div>
    </article>
  );
}

export function GameGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}
