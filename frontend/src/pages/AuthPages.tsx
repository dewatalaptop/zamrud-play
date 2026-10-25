import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { useI18n } from "../i18n";
import { Disclosure } from "../components/Layout";
import { Logo, Spinner } from "../components/ui";

function Shell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-md gap-6 py-6">
      <div className="text-center"><div className="mb-5 flex justify-center"><Logo size={44} /></div><h1 className="text-2xl font-extrabold">{title}</h1><p className="mt-1 text-sm text-muted">{subtitle}</p></div>
      <div className="card card-glow">{children}</div>
      <p className="text-center text-sm text-muted">{footer}</p>
      <div className="rounded-2xl border border-line bg-surface p-3"><Disclosure /></div>
    </div>
  );
}

function errMsg(e: unknown, t: (k: string) => string) {
  const code = e instanceof ApiError ? e.code : "INTERNAL_ERROR";
  const m = t(`errors.${code}`);
  return m.startsWith("errors.") ? t("errors.INTERNAL_ERROR") : m;
}

export function Login() {
  const { t } = useI18n();
  const { me, refresh } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (me) return <Navigate to={loc.state?.from ?? "/dashboard"} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await api.post("/auth/login", { identifier, password });
      await refresh();
      nav(loc.state?.from ?? "/dashboard", { replace: true });
    } catch (err) { setError(errMsg(err, t)); } finally { setBusy(false); }
  };
  return (
    <Shell title={t("auth.loginTitle")} subtitle={t("auth.loginSubtitle")} footer={<>{t("auth.noAccount")} <Link className="font-semibold text-brand-400 hover:underline" to="/register">{t("nav.register")}</Link></>}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <label className="grid gap-1.5 text-sm font-semibold">{t("auth.identifier")}<input className="input" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required /></label>
        <label className="grid gap-1.5 text-sm font-semibold">{t("auth.password")}<input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p role="alert" className="rounded-xl bg-[var(--error-bg)] px-3 py-2 text-sm text-err">{error}</p>}
        <button className="btn btn-primary btn-lg" disabled={busy || !identifier || !password}>{busy ? <Spinner /> : t("nav.login")}</button>
      </form>
    </Shell>
  );
}

export function Register() {
  const { t, locale } = useI18n();
  const { me, refresh } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", username: "", displayName: "", password: "", agree: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (me) return <Navigate to="/dashboard" replace />;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === "agree" ? e.target.checked : e.target.value });
  const valid = f.email.includes("@") && /^[A-Za-z0-9_]{3,20}$/.test(f.username) && f.displayName.trim().length >= 2 && f.password.length >= 8 && f.agree;

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await api.post("/auth/register", { email: f.email, username: f.username, displayName: f.displayName, password: f.password, locale });
      await refresh();
      nav("/dashboard", { replace: true });
    } catch (err) { setError(errMsg(err, t)); } finally { setBusy(false); }
  };
  return (
    <Shell title={t("auth.registerTitle")} subtitle={t("auth.registerSubtitle")} footer={<>{t("auth.haveAccount")} <Link className="font-semibold text-brand-400 hover:underline" to="/login">{t("nav.login")}</Link></>}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <label className="grid gap-1.5 text-sm font-semibold">{t("auth.email")}<input className="input" type="email" autoComplete="email" value={f.email} onChange={set("email")} required /></label>
        <label className="grid gap-1.5 text-sm font-semibold">{t("auth.username")}<input className="input" autoComplete="username" value={f.username} onChange={set("username")} required aria-describedby="uh" /><span id="uh" className="text-xs font-normal text-faint">{t("auth.usernameHint")}</span></label>
        <label className="grid gap-1.5 text-sm font-semibold">{t("auth.displayName")}<input className="input" value={f.displayName} onChange={set("displayName")} maxLength={30} required aria-describedby="dh" /><span id="dh" className="text-xs font-normal text-faint">{t("auth.displayNameHint")}</span></label>
        <label className="grid gap-1.5 text-sm font-semibold">{t("auth.password")}<input className="input" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} required aria-describedby="ph" /><span id="ph" className="text-xs font-normal text-faint">{t("auth.passwordHint")}</span></label>
        <label className="flex items-start gap-2 text-sm text-muted"><input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-500" checked={f.agree} onChange={set("agree")} /><span>{t("auth.agreePrefix")} <Link to="/terms" className="font-semibold text-brand-400 underline">{t("nav.terms")}</Link> &amp; <Link to="/privacy" className="font-semibold text-brand-400 underline">{t("nav.privacy")}</Link>. {t("auth.agreeVirtual")}</span></label>
        {error && <p role="alert" className="rounded-xl bg-[var(--error-bg)] px-3 py-2 text-sm text-err">{error}</p>}
        <button className="btn btn-primary btn-lg" disabled={busy || !valid}>{busy ? <Spinner /> : t("auth.createAccount")}</button>
      </form>
    </Shell>
  );
}
