import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { useI18n } from "../i18n";
import { CATEGORIES, TAGS } from "../lib/types";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { useToast } from "../components/Toast";
import { AVATAR_COLORS, AVATAR_ICONS, PageHeader, UserAvatar } from "../components/ui";
import { ProgressBar } from "../components/MissionCard";

export function Profile() {
  const { t, n } = useI18n();
  const { me, setMe } = useAuth();
  const { toast, toastError } = useToast();
  const [p, setP] = useState(me!.profile);
  const [pref, setPref] = useState(me!.preferences);
  const [confirm, setConfirm] = useState<null | "reset" | "events">(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (me) { setP(me.profile); setPref(me.preferences); } }, [me?.profile, me?.preferences]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!me) return null;

  const saveProfile = async () => {
    setBusy(true);
    try { setMe(await api.patch("/me/profile", { displayName: p.displayName, avatarColor: p.avatarColor, avatarIcon: p.avatarIcon, bio: p.bio, showOnLeaderboard: p.showOnLeaderboard })); toast(t("common.saved")); }
    catch (e) { toastError(e); } finally { setBusy(false); }
  };
  const savePrefs = async (patch: Partial<typeof pref>) => {
    const next = { ...pref, ...patch };
    setPref(next);
    try {
      setMe(await api.patch("/me/preferences", {
        favoriteCategories: next.favoriteCategories, preferredTags: next.preferredTags, difficulty: next.difficulty,
        personalizationEnabled: next.personalizationEnabled, animationIntensity: next.animationIntensity,
      }));
      toast(t("common.saved"));
    } catch (e) { toastError(e); }
  };
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const doConfirm = async () => {
    setBusy(true);
    try {
      if (confirm === "reset") setMe(await api.post("/me/recommendations/reset"));
      else await api.del("/me/events");
      toast(t("common.saved"));
    } catch (e) { toastError(e); } finally { setBusy(false); setConfirm(null); }
  };
  const lbl = "grid gap-1.5 text-sm font-semibold";

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t("nav.profile")} title={t("profile.title")} subtitle={t("profile.subtitle")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card grid gap-5" aria-labelledby="pf">
          <h2 id="pf" className="text-lg font-bold">{t("profile.identity")}</h2>
          <div className="flex items-center gap-4"><UserAvatar name={p.displayName} color={p.avatarColor} icon={p.avatarIcon} size={72} />
            <div><p className="text-xl font-extrabold">{p.displayName}</p><p className="text-sm text-faint">@{me.username} · {t("common.level")} {me.level.level}</p></div></div>
          <div><p className="mb-1.5 text-xs text-faint num">{n(me.level.xp)} / {n(me.level.nextXp)} XP</p><ProgressBar value={Math.round(me.level.progress * 100)} max={100} label={t("dashboard.progress")} /></div>
          <fieldset><legend className="mb-2 text-sm font-semibold">{t("profile.avatarColor")}</legend>
            <div className="flex flex-wrap gap-2">{AVATAR_COLORS.map((c) => <button key={c} type="button" aria-pressed={p.avatarColor === c} aria-label={c} onClick={() => setP({ ...p, avatarColor: c })} className={`rounded-full p-0.5 ${p.avatarColor === c ? "ring-2 ring-brand-400" : ""}`}><UserAvatar name={c} color={c} icon={p.avatarIcon} size={36} /></button>)}</div></fieldset>
          <fieldset><legend className="mb-2 text-sm font-semibold">{t("profile.avatarIcon")}</legend>
            <div className="flex flex-wrap gap-2">{AVATAR_ICONS.map((i) => <button key={i} type="button" aria-pressed={p.avatarIcon === i} aria-label={i} onClick={() => setP({ ...p, avatarIcon: i })} className={`rounded-full p-0.5 ${p.avatarIcon === i ? "ring-2 ring-brand-400" : ""}`}><UserAvatar name={i} color={p.avatarColor} icon={i} size={36} /></button>)}</div></fieldset>
          <label className={lbl}>{t("auth.displayName")}<input className="input" maxLength={30} value={p.displayName} onChange={(e) => setP({ ...p, displayName: e.target.value })} /></label>
          <label className={lbl}>{t("profile.bio")}<textarea className="textarea" rows={3} maxLength={140} value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} /><span className="text-xs font-normal text-faint">{p.bio.length}/140</span></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-500" checked={p.showOnLeaderboard} onChange={(e) => setP({ ...p, showOnLeaderboard: e.target.checked })} /><span>{t("profile.showLeaderboard")}<span className="block text-xs text-faint">{t("profile.showLeaderboardHint")}</span></span></label>
          <div><button className="btn btn-primary" disabled={busy || p.displayName.trim().length < 2} onClick={saveProfile}>{t("common.save")}</button></div>
        </section>

        <section className="card grid content-start gap-5" aria-labelledby="pp">
          <h2 id="pp" className="text-lg font-bold">{t("profile.playPrefs")}</h2>
          <p className="text-sm text-muted">{t("profile.prefsIntro")}</p>
          <fieldset><legend className="mb-2 text-sm font-semibold">{t("profile.favCategories")}</legend>
            <div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => <button key={c} type="button" className="bet-btn" aria-pressed={pref.favoriteCategories.includes(c)} onClick={() => savePrefs({ favoriteCategories: toggle(pref.favoriteCategories, c) })}>{t(`games.categories.${c}`)}</button>)}</div></fieldset>
          <fieldset><legend className="mb-2 text-sm font-semibold">{t("profile.favTags")}</legend>
            <div className="flex flex-wrap gap-2">{TAGS.map((x) => <button key={x} type="button" className="bet-btn" aria-pressed={pref.preferredTags.includes(x)} onClick={() => savePrefs({ preferredTags: toggle(pref.preferredTags, x) })}>{t(`rec.tags.${x}`)}</button>)}</div></fieldset>
          <label className={lbl}>{t("profile.difficulty")}<select className="select" value={pref.difficulty} onChange={(e) => savePrefs({ difficulty: e.target.value })}>{["any", "easy", "medium", "hard"].map((d) => <option key={d} value={d}>{d === "any" ? t("profile.anyDifficulty") : t(`games.difficulty.${d}`)}</option>)}</select></label>
          <label className={lbl}>{t("profile.animation")}<select className="select" value={pref.animationIntensity} onChange={(e) => savePrefs({ animationIntensity: e.target.value as typeof pref.animationIntensity })}>{["FULL", "REDUCED", "OFF"].map((a) => <option key={a} value={a}>{t(`profile.anim.${a}`)}</option>)}</select><span className="text-xs font-normal text-faint">{t("profile.animationHint")}</span></label>

          <div className="rounded-2xl border border-line bg-surface-2 p-4">
            <label className="flex items-start gap-2 text-sm font-semibold"><input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-500" checked={pref.personalizationEnabled} onChange={(e) => savePrefs({ personalizationEnabled: e.target.checked })} /><span>{t("profile.personalization")}<span className="block text-xs font-normal text-muted">{t("profile.personalizationHint")}</span></span></label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirm("reset")}>{t("profile.resetRec")}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirm("events")}>{t("profile.deleteEvents")}</button>
            </div>
          </div>
          <p className="text-xs text-muted">{t("profile.noManipulation")}</p>
        </section>
      </div>
      <ConfirmationDialog open={confirm !== null} title={confirm === "reset" ? t("profile.resetRec") : t("profile.deleteEvents")} busy={busy} onConfirm={doConfirm} onCancel={() => setConfirm(null)}>
        {confirm === "reset" ? t("profile.resetRecText") : t("profile.deleteEventsText")}
      </ConfirmationDialog>
    </div>
  );
}
