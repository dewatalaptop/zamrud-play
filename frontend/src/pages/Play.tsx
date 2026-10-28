import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, LogOut } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useI18n } from "../i18n";
import type { GameInfo } from "../lib/types";
import { EmptyState } from "../components/EmptyState";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { GameInstructionsDialog } from "../components/GameInstructionsDialog";
import { usePlaySession, fmtDuration } from "../components/SessionReminder";
import { Disclosure } from "../components/Layout";

// Muat kode game hanya saat dibutuhkan (lazy loading).
const Games: Record<string, React.LazyExoticComponent<React.ComponentType<{ game: GameInfo }>>> = {
  "virtual-slots": lazy(() => import("../components/games/SlotsGame")),
  "euro-roulette": lazy(() => import("../components/games/RouletteGame")),
  "blackjack-21": lazy(() => import("../components/games/BlackjackGame")),
  "dice-duel": lazy(() => import("../components/games/DiceGame")),
};

export default function Play() {
  const { slug = "" } = useParams();
  const { t, tl } = useI18n();
  const { beat } = usePlaySession();
  const { data: g, loading, error } = useApi(() => api.get<GameInfo>(`/games/${slug}`), [slug]);
  const [rules, setRules] = useState(false);

  // Aturan ditampilkan sebelum bermain (sekali per game per perangkat), selalu bisa dibuka lagi.
  useEffect(() => {
    if (!g) return;
    try {
      if (!localStorage.getItem(`zp-rules-${g.slug}`)) { setRules(true); localStorage.setItem(`zp-rules-${g.slug}`, "1"); }
    } catch { setRules(true); }
  }, [g?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSkeleton rows={3} height={160} />;
  if (error || !g || !Games[g.slug]) return <EmptyState art="notfound" title={t("games.notFound")} action={<Link to="/games" className="btn btn-primary">{t("games.title")}</Link>} />;
  const Game = Games[g.slug];

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="eyebrow">{t(`games.categories.${g.category}`)}</p><h1 className="text-2xl font-extrabold">{tl(g.name)}</h1></div>
        <div className="flex flex-wrap items-center gap-2">
          {beat && <span className="chip">{t("session.timer")}: {fmtDuration(beat.sessionSeconds)}</span>}
          <button className="btn btn-secondary btn-sm" onClick={() => setRules(true)}><BookOpen size={15} />{t("game.rules")}</button>
          <Link to="/games" className="btn btn-ghost btn-sm" aria-label={t("game.exit")}><LogOut size={15} />{t("game.exit")}</Link>
        </div>
      </div>
      <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("game.virtualNote")}</p>
      <Suspense fallback={<LoadingSkeleton rows={3} height={140} />}><Game game={g} /></Suspense>
      <p className="text-xs text-faint">{t("game.noPrediction")}</p>
      <div className="rounded-2xl border border-line bg-surface p-3"><Disclosure /></div>
      <GameInstructionsDialog game={g} open={rules} onClose={() => setRules(false)} />
    </div>
  );
}
