import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { applyAppearance, useAuth } from "../auth/AuthProvider";
import { useI18n, type Locale } from "../i18n";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { ResponsiblePlayPanel } from "../components/ResponsiblePlayPanel";
import { useToast } from "../components/Toast";
import { PageHeader } from "../components/ui";

export default function Settings() {
  const { t, locale, setLocale } = useI18n();
  const { me, setMe, logout } = useAuth();
  const { toast, toastError } = useToast();
  const nav = useNavigate();
  const [pw, setPw] = useState({ current: "", next: "" });
  const [support, setSupport] = useState({ subject: "", message: "" });
  const [delPw, setDelPw] = useState("");
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  const pr = me.preferences;
  const lbl = "grid gap-1.5 text-sm font-semibold";

  const patch = async (body: Record<string, unknown>) => {
    try { const m = await api.patch<typeof me>("/me/preferences", body); setMe(m); toast(t("common.saved")); } catch (e) { toastError(e); }
  };
  const changePw = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await api.post("/auth/change-password", pw); setPw({ current: "", next: "" }); toast(t("settings.pwChanged")); } catch (err) { toastError(err); } finally { setBusy(false); }
  };
  const sendSupport = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await api.post("/me/support", support); setSupport({ subject: "", message: "" }); toast(t("settings.supportSent")); } catch (err) { toastError(err); } finally { setBusy(false); }
  };
  const del = async () => {
    setBusy(true);
    try { await api.post("/auth/delete-account", { password: delPw }); await logout(); nav("/"); } catch (e) { toastError(e); setBusy(false); }
  };

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t("nav.settings")} title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card grid content-start gap-4" aria-labelledby="ap">
          <h2 id="ap" className="text-lg font-bold">{t("settings.appearance")}</h2>
          <label className={lbl}>{t("common.language")}
            <select className="select" value={locale} onChange={(e) => { setLocale(e.target.value as Locale); void patch({ locale: e.target.value }); }}><option value="id">Indonesia</option><option value="en">English</option></select></label>
          <label className={lbl}>{t("settings.theme")}
            <select className="select" value={pr.theme} onChange={(e) => { applyAppearance(e.target.value, pr.animationIntensity, pr.highContrast); void patch({ theme: e.target.value }); }}><option value="dark">{t("settings.dark")}</option><option value="light">{t("settings.light")}</option></select></label>
          <label className="flex items-start gap-2 text-sm font-semibold"><input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-500" checked={pr.highContrast} onChange={(e) => { applyAppearance(pr.theme, pr.animationIntensity, e.target.checked); void patch({ highContrast: e.target.checked }); }} /><span>{t("settings.highContrast")}<span className="block text-xs font-normal text-muted">{t("settings.highContrastHint")}</span></span></label>
          <label className={lbl}>{t("profile.animation")}
            <select className="select" value={pr.animationIntensity} onChange={(e) => { applyAppearance(pr.theme, e.target.value, pr.highContrast); void patch({ animationIntensity: e.target.value }); }}>{["FULL", "REDUCED", "OFF"].map((a) => <option key={a} value={a}>{t(`profile.anim.${a}`)}</option>)}</select></label>
        </section>

        <section className="card grid content-start gap-4" aria-labelledby="ac">
          <h2 id="ac" className="text-lg font-bold">{t("settings.account")}</h2>
          <dl className="grid gap-1 text-sm"><dt className="text-faint">{t("auth.email")}</dt><dd className="font-semibold">{me.email}</dd><dt className="mt-2 text-faint">{t("auth.username")}</dt><dd className="font-semibold">@{me.username}</dd></dl>
          <label className="flex items-start gap-2 text-sm font-semibold"><input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-500" checked={pr.engagementNotifications} onChange={(e) => void patch({ engagementNotifications: e.target.checked })} /><span>{t("settings.notifications")}<span className="block text-xs font-normal text-muted">{t("settings.notificationsHint")}</span></span></label>
          <form onSubmit={changePw} className="grid gap-3 border-t border-line pt-4">
            <h3 className="font-bold">{t("settings.changePw")}</h3>
            <label className={lbl}>{t("settings.currentPw")}<input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></label>
            <label className={lbl}>{t("settings.newPw")}<input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></label>
            <div><button className="btn btn-secondary" disabled={busy || !pw.current || pw.next.length < 8}>{t("settings.changePw")}</button></div>
          </form>
        </section>

        <section className="card lg:col-span-2"><ResponsiblePlayPanel /></section>

        <form className="card grid content-start gap-3" onSubmit={sendSupport} aria-labelledby="sp">
          <h2 id="sp" className="text-lg font-bold">{t("settings.support")}</h2>
          <p className="text-sm text-muted">{t("settings.supportText")}</p>
          <label className={lbl}>{t("settings.subject")}<input className="input" maxLength={100} value={support.subject} onChange={(e) => setSupport({ ...support, subject: e.target.value })} /></label>
          <label className={lbl}>{t("settings.message")}<textarea className="textarea" rows={4} maxLength={1000} value={support.message} onChange={(e) => setSupport({ ...support, message: e.target.value })} /></label>
          <div><button className="btn btn-primary" disabled={busy || support.subject.trim().length < 3 || support.message.trim().length < 10}>{t("settings.send")}</button></div>
        </form>

        <section className="card grid content-start gap-3 border-[var(--error-text)]/40" aria-labelledby="dg">
          <h2 id="dg" className="text-lg font-bold text-err">{t("settings.danger")}</h2>
          <p className="text-sm text-muted">{t("settings.deleteText")}</p>
          <div><button className="btn btn-danger" onClick={() => setDelOpen(true)} disabled={me.role === "ADMIN"}>{t("settings.deleteAccount")}</button></div>
          {me.role === "ADMIN" && <p className="text-xs text-faint">{t("errors.ADMIN_CANNOT_SELF_DELETE")}</p>}
        </section>
      </div>
      <ConfirmationDialog open={delOpen} danger busy={busy || delPw.length < 1} title={t("settings.deleteAccount")} confirmLabel={t("settings.deleteConfirm")} onConfirm={del} onCancel={() => { setDelOpen(false); setDelPw(""); }}>
        <p>{t("settings.deleteWarning")}</p>
        <label className="mt-3 grid gap-1.5 text-sm font-semibold text-ink">{t("auth.password")}<input className="input" type="password" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} /></label>
      </ConfirmationDialog>
    </div>
  );
}
