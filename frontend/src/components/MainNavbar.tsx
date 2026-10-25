import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LogOut, Menu, Shield, User, X, Settings as Cog } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useT } from "../i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { SessionTimer } from "./SessionReminder";
import { VirtualWalletCard } from "./VirtualWalletCard";
import { Logo, UserAvatar } from "./ui";

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${isActive ? "bg-brand-50 text-brand-700" : "text-muted hover:text-ink hover:bg-surface-2"}`;

export function MainNavbar() {
  const { me, logout } = useAuth();
  const t = useT();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  const doLogout = async () => { await logout(); setMenu(false); nav("/"); };

  return (
    <header className="glass sticky top-0 z-40 border-x-0 border-t-0">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to={me ? "/dashboard" : "/"} aria-label="Zamrud Play" className="shrink-0"><span className="sm:hidden"><Logo withWord={false} /></span><span className="hidden sm:inline"><Logo /></span></Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label={t("nav.main")}>
          <NavLink to="/games" className={link}>{t("nav.games")}</NavLink>
          <NavLink to="/leaderboard" className={link}>{t("nav.leaderboard")}</NavLink>
          {me && <NavLink to="/missions" className={link}>{t("nav.missions")}</NavLink>}
          {me && <NavLink to="/statistics" className={link}>{t("nav.statistics")}</NavLink>}
          <NavLink to="/about" className={link}>{t("nav.about")}</NavLink>
          <NavLink to="/responsible-play" className={link}>{t("nav.responsible")}</NavLink>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {me && <SessionTimer />}
          {me && <VirtualWalletCard balance={me.balance} compact />}
          <span className="hidden sm:block"><LanguageSwitcher /></span>
          <ThemeToggle />
          {me ? (
            <div className="relative">
              <button onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu} aria-label={t("nav.accountMenu")} className="rounded-full">
                <UserAvatar name={me.profile.displayName} color={me.profile.avatarColor} icon={me.profile.avatarIcon} size={36} />
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 mt-2 w-60 rounded-2xl border border-line bg-surface p-2 shadow-card" onClick={() => setMenu(false)}>
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-bold">{me.profile.displayName}</p>
                    <p className="truncate text-xs text-faint">@{me.username} · {t("common.level")} {me.level.level}</p>
                  </div>
                  <Link role="menuitem" to="/profile" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-surface-2"><User size={16} />{t("nav.profile")}</Link>
                  <Link role="menuitem" to="/settings" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-surface-2"><Cog size={16} />{t("nav.settings")}</Link>
                  {me.role === "ADMIN" && <Link role="menuitem" to="/admin" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-surface-2"><Shield size={16} />{t("nav.admin")}</Link>}
                  <button role="menuitem" onClick={doLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-err hover:bg-surface-2"><LogOut size={16} />{t("nav.logout")}</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm hidden sm:inline-flex">{t("nav.login")}</Link>
              <Link to="/register" className="btn btn-primary btn-sm">{t("nav.register")}</Link>
            </>
          )}
          <button className="btn btn-ghost !p-2 lg:hidden" aria-label={t("nav.menu")} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-line px-4 pb-4 pt-2 lg:hidden" aria-label={t("nav.main")} onClick={() => setOpen(false)}>
          <div className="grid gap-1">
            <NavLink to="/games" className={link}>{t("nav.games")}</NavLink>
            <NavLink to="/leaderboard" className={link}>{t("nav.leaderboard")}</NavLink>
            {me && <NavLink to="/statistics" className={link}>{t("nav.statistics")}</NavLink>}
            {me && <NavLink to="/history" className={link}>{t("nav.history")}</NavLink>}
            {me && <NavLink to="/achievements" className={link}>{t("nav.achievements")}</NavLink>}
            <NavLink to="/about" className={link}>{t("nav.about")}</NavLink>
            <NavLink to="/responsible-play" className={link}>{t("nav.responsible")}</NavLink>
            {!me && <NavLink to="/login" className={link}>{t("nav.login")}</NavLink>}
            <div className="pt-2 sm:hidden"><LanguageSwitcher /></div>
          </div>
        </nav>
      )}
    </header>
  );
}
