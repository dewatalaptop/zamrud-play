import { Award, BarChart3, BookOpen, Brain, Compass, Heart, Layers, Lock, Play } from "lucide-react";
import { useI18n } from "../i18n";
import type { Achievement } from "../lib/types";
import { ProgressBar } from "./MissionCard";

const ICONS: Record<string, typeof Award> = { play: Play, compass: Compass, brain: Brain, layers: Layers, chart: BarChart3, book: BookOpen, heart: Heart };

export function AchievementBadge({ a }: { a: Achievement }) {
  const { t, tl, date } = useI18n();
  const Icon = ICONS[a.icon] ?? Award;
  const done = !!a.unlockedAt;
  return (
    <article className={`card flex flex-col items-center gap-3 text-center ${done ? "border-[hsl(43_80%_45%/.5)]" : ""}`} aria-label={`${tl(a.name)} — ${done ? t("achievements.unlocked") : t("achievements.locked")}`}>
      <div className={`grid h-16 w-16 place-items-center rounded-2xl ${done ? "bg-gradient-to-br from-amber-300 to-amber-600 text-amber-950 shadow-[0_8px_24px_-8px_hsl(43_96%_50%/.6)]" : "bg-surface-2 text-faint"}`}>
        {done ? <Icon size={30} aria-hidden="true" /> : <Lock size={26} aria-hidden="true" />}
      </div>
      <div>
        <h3 className="font-bold">{tl(a.name)}</h3>
        <p className="mt-1 text-sm text-muted">{tl(a.description)}</p>
      </div>
      {done ? (
        <p className="text-xs font-semibold text-gold">{t("achievements.unlockedOn", { date: date(a.unlockedAt!, false) })}</p>
      ) : (
        <div className="w-full">
          <ProgressBar value={a.progress} max={a.threshold} label={`${tl(a.name)}: ${a.progress}/${a.threshold}`} />
          <p className="num mt-1 text-xs text-faint">{a.progress}/{a.threshold}</p>
        </div>
      )}
    </article>
  );
}
