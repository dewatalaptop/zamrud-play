import { Check, Gift } from "lucide-react";
import { useI18n } from "../i18n";
import type { Mission } from "../lib/types";
import { CoinIcon } from "./ui";

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label} className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function RewardBadge({ coins }: { coins: number }) {
  const { n } = useI18n();
  return <span className="chip !bg-[var(--gold-soft)] !text-gold"><CoinIcon size={14} />+{n(coins)}</span>;
}

export function MissionCard({ mission, onClaim, busy }: { mission: Mission; onClaim: (m: Mission) => void; busy?: boolean }) {
  const { t, tl, n } = useI18n();
  const title = tl(mission.title);
  return (
    <article className={`card flex flex-col gap-3 ${mission.completed && !mission.claimed ? "card-glow" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="eyebrow">{t(`missions.period.${mission.period}`)}</span>
          <h3 className="mt-1 font-bold leading-snug">{title}</h3>
          <p className="mt-1 text-sm text-muted">{tl(mission.description)}</p>
        </div>
        {mission.rewardCoins > 0 && <RewardBadge coins={mission.rewardCoins} />}
      </div>
      <div className="mt-auto grid gap-2">
        <div className="flex items-center justify-between text-xs text-faint"><span>{t("missions.progress")}</span><span className="num">{n(mission.progress)}/{n(mission.target)}</span></div>
        <ProgressBar value={mission.progress} max={mission.target} label={`${title}: ${mission.progress}/${mission.target}`} />
        {mission.claimed ? (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ok"><Check size={16} />{t("missions.claimed")}</p>
        ) : mission.completed ? (
          <button className="btn btn-gold btn-sm" disabled={busy} onClick={() => onClaim(mission)}><Gift size={16} />{t("missions.claim")}</button>
        ) : (
          <p className="text-xs text-faint">{t("missions.noPressure")}</p>
        )}
      </div>
    </article>
  );
}
