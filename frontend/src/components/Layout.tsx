import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { Info } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useT } from "../i18n";
import { MainNavbar } from "./MainNavbar";
import { MobileNavigation } from "./MobileNavigation";
import { Logo } from "./ui";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { PlaySessionProvider } from "./SessionReminder";

export function Disclosure({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <p className={`flex items-start gap-2 text-xs text-muted ${className}`} role="note">
      <Info size={14} className="mt-0.5 shrink-0 text-brand-400" aria-hidden="true" />
      <span>{t("disclosure.main")}</span>
    </p>
  );
}

export function Footer() {
  const t = useT();
  const col = "grid content-start gap-2 text-sm text-muted";
  return (
    <footer className="mt-16 border-t border-line bg-surface/60 pb-24 lg:pb-8">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-md text-sm text-muted">{t("footer.about")}</p>
          <div className="mt-4 rounded-2xl border border-line bg-surface-2 p-3"><Disclosure /></div>
        </div>
        <nav className={col} aria-label={t("footer.explore")}>
          <p className="eyebrow">{t("footer.explore")}</p>
          <Link to="/games" className="hover:text-ink">{t("nav.games")}</Link>
          <Link to="/leaderboard" className="hover:text-ink">{t("nav.leaderboard")}</Link>
          <Link to="/about" className="hover:text-ink">{t("nav.about")}</Link>
        </nav>
        <nav className={col} aria-label={t("footer.legal")}>
          <p className="eyebrow">{t("footer.legal")}</p>
          <Link to="/responsible-play" className="hover:text-ink">{t("nav.responsible")}</Link>
          <Link to="/privacy" className="hover:text-ink">{t("nav.privacy")}</Link>
          <Link to="/terms" className="hover:text-ink">{t("nav.terms")}</Link>
          <button type="button" className="text-left hover:text-ink" onClick={() => window.BugReporter?.openDialog({ title: t("common.reportBug") })}>{t("common.reportBug")}</button>
        </nav>
      </div>
      <p className="mx-auto max-w-7xl px-4 text-xs text-faint sm:px-6">© {new Date().getFullYear()} Zamrud Play · {t("footer.rights")}</p>
    </footer>
  );
}

/** Kerangka halaman: navbar, konten, footer, navigasi bawah untuk pemain yang login. */
export function AppShell() {
  const { me } = useAuth();
  const t = useT();
  return (
    <PlaySessionProvider>
      <a href="#main" className="skip-link">{t("nav.skip")}</a>
      <MainNavbar />
      <main id="main" className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:pb-8" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      {me && <MobileNavigation />}
    </PlaySessionProvider>
  );
}

/**
 * Pelindung rute SISI KLIEN (hanya kenyamanan UX). Keamanan sebenarnya ada di server:
 * setiap endpoint memeriksa sesi & peran pada tiap permintaan.
 */
export function RequireAuth({ admin }: { admin?: boolean }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="mx-auto max-w-3xl p-8"><LoadingSkeleton rows={4} /></div>;
  if (!me) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (admin && me.role !== "ADMIN") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
