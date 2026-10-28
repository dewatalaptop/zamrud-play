import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { Award, BarChart3, Coins, Gift, HeartPulse, ShieldCheck, Sparkles, Target } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useAuth } from "../auth/AuthProvider";
import { useI18n } from "../i18n";
import type { GameInfo } from "../lib/types";
import { GameCard, GameGrid } from "../components/GameCard";
import { GridSkeleton } from "../components/LoadingSkeleton";
import { Disclosure } from "../components/Layout";
import { ButtonLink, CoinIcon } from "../components/ui";
import { ProgressBar } from "../components/MissionCard";
const StatisticsChart = lazy(() => import("../components/StatisticsChart").then((m) => ({ default: m.StatisticsChart })));
import { SymbolIcon } from "../components/games/art";

export default function Landing() {
  const { t, n } = useI18n();
  const { me } = useAuth();
  const games = useApi(() => api.get<GameInfo[]>("/games"));
  const demo = [{ name: "1", value: 2 }, { name: "2", value: 4 }, { name: "3", value: 3 }, { name: "4", value: 6 }, { name: "5", value: 5 }, { name: "6", value: 7 }, { name: "7", value: 6 }];

  return (
    <div className="grid gap-16">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] border border-line px-6 py-12 sm:px-12 sm:py-20" style={{ background: "radial-gradient(90% 120% at 100% 0%, hsl(155 60% 22% / .7), transparent 60%), linear-gradient(160deg, var(--surface), var(--bg))" }}>
        <img src="/img/hero-bg.webp" alt="" aria-hidden="true" width={1376} height={768} fetchPriority="high" decoding="async" className="hero-bg-img pointer-events-none absolute inset-0 h-full w-full object-cover" />
        <div className="bg-pattern-dots pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <p className="eyebrow mb-3 flex items-center gap-2"><Sparkles size={14} />{t("landing.eyebrow")}</p>
            <h1 className="text-4xl font-extrabold leading-[1.08] sm:text-6xl">{t("landing.title")}</h1>
            <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">{t("landing.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to={me ? "/dashboard" : "/register"} size="lg">{t("landing.cta")}</ButtonLink>
              <ButtonLink to="/games" variant="secondary" size="lg">{t("landing.secondary")}</ButtonLink>
            </div>
            <div className="mt-8 max-w-xl rounded-2xl border border-line bg-surface/70 p-4 backdrop-blur"><Disclosure /></div>
          </div>
          <div className="relative hidden lg:block" aria-hidden="true">
            <img src="/img/mascot.webp" alt="" width={440} height={600} loading="lazy" decoding="async" className="mascot-img pointer-events-none absolute -right-28 -top-28 z-10 w-64" />
            <div className="slot-machine mx-auto mr-32 max-w-[18rem] rotate-2">
              <div className="grid grid-cols-3 gap-3">{["SEVEN", "STAR", "DIAMOND"].map((s) => <div key={s} className="reel grid place-items-center"><SymbolIcon id={s} size={76} /></div>)}</div>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm"><span className="flex items-center gap-2 text-muted"><CoinIcon size={18} />{t("landing.demoBalance")}</span><span className="num font-bold">{n(10000)}</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured games */}
      <section aria-labelledby="featured">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div><p className="eyebrow mb-1">{t("landing.featuredEyebrow")}</p><h2 id="featured" className="text-2xl font-extrabold sm:text-3xl">{t("landing.featuredTitle")}</h2></div>
          <Link to="/games" className="btn btn-ghost btn-sm">{t("landing.allGames")}</Link>
        </div>
        {games.loading ? <GridSkeleton /> : games.data && <GameGrid>{games.data.map((g) => <GameCard key={g.slug} game={g} authed={!!me} />)}</GameGrid>}
      </section>

      {/* Virtual coins */}
      <section className="grid items-center gap-8 lg:grid-cols-2" aria-labelledby="coins">
        <div>
          <p className="eyebrow mb-1">{t("landing.coinsEyebrow")}</p>
          <h2 id="coins" className="text-2xl font-extrabold sm:text-3xl">{t("landing.coinsTitle")}</h2>
          <p className="mt-3 text-muted">{t("landing.coinsBody")}</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {[[Gift, "free"], [ShieldCheck, "noMoney"], [Coins, "noTransfer"], [HeartPulse, "noPressure"]].map(([Icon, k]) => {
            const I = Icon as typeof Gift;
            return <li key={k as string} className="card flex gap-3 !p-4"><I className="mt-0.5 shrink-0 text-brand-400" size={22} aria-hidden="true" /><div><p className="font-bold">{t(`landing.coins_${k}.title`)}</p><p className="mt-1 text-sm text-muted">{t(`landing.coins_${k}.text`)}</p></div></li>;
          })}
        </ul>
      </section>

      {/* Progression & achievements */}
      <section aria-labelledby="progress">
        <div className="mb-6"><p className="eyebrow mb-1">{t("landing.progressEyebrow")}</p><h2 id="progress" className="text-2xl font-extrabold sm:text-3xl">{t("landing.progressTitle")}</h2><p className="mt-2 max-w-2xl text-muted">{t("landing.progressBody")}</p></div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card"><div className="flex items-center gap-2 font-bold"><Target className="text-brand-400" size={20} />{t("landing.missionDemo")}</div><p className="mt-2 text-sm text-muted">{t("landing.missionDemoText")}</p><div className="mt-4"><ProgressBar value={2} max={3} label={t("landing.missionDemo")} /></div><p className="mt-1 text-xs text-faint">2/3 · {t("common.example")}</p></div>
          <div className="card"><div className="flex items-center gap-2 font-bold"><Award className="text-gold" size={20} />{t("landing.badgeDemo")}</div><div className="mt-4 flex gap-3">{["from-amber-300 to-amber-600", "from-slate-300 to-slate-500", "from-slate-600 to-slate-800"].map((c, i) => <div key={i} className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${c} ${i === 2 ? "opacity-40" : ""}`}><Award className="text-black/60" /></div>)}</div><p className="mt-3 text-xs text-faint">{t("common.example")}</p></div>
          <div className="card"><div className="flex items-center gap-2 font-bold"><Sparkles className="text-brand-400" size={20} />{t("landing.levelDemo")}</div><p className="num mt-3 font-display text-3xl font-extrabold">{t("common.level")} 4</p><div className="mt-3"><ProgressBar value={62} max={100} label={t("landing.levelDemo")} /></div><p className="mt-1 text-xs text-faint">{t("common.example")}</p></div>
        </div>
      </section>

      {/* Statistics preview */}
      <section className="grid items-center gap-8 lg:grid-cols-2" aria-labelledby="stats">
        <div className="card">
          <Suspense fallback={<div className="skeleton h-[200px]" />}><StatisticsChart title={t("landing.statsDemoChart")} type="bar" data={demo} height={200} /></Suspense>
          <p className="mt-2 text-xs text-faint">{t("common.example")}</p>
        </div>
        <div>
          <p className="eyebrow mb-1 flex items-center gap-2"><BarChart3 size={14} />{t("landing.statsEyebrow")}</p>
          <h2 id="stats" className="text-2xl font-extrabold sm:text-3xl">{t("landing.statsTitle")}</h2>
          <p className="mt-3 text-muted">{t("landing.statsBody")}</p>
        </div>
      </section>

      {/* Responsible play */}
      <section className="card card-glow grid gap-4 !p-8 md:grid-cols-[auto_1fr_auto] md:items-center">
        <HeartPulse size={40} className="text-brand-400" aria-hidden="true" />
        <div><h2 className="text-xl font-extrabold">{t("landing.rpTitle")}</h2><p className="mt-1 text-muted">{t("landing.rpBody")}</p></div>
        <ButtonLink to="/responsible-play" variant="secondary">{t("landing.rpCta")}</ButtonLink>
      </section>
    </div>
  );
}
