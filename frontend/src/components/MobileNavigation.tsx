import { NavLink } from "react-router-dom";
import { Gamepad2, LayoutDashboard, Target, UserRound, Wallet } from "lucide-react";
import { useT } from "../i18n";

/** Navigasi bawah untuk layar kecil (hanya pemain yang login). */
export function MobileNavigation() {
  const t = useT();
  const items = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { to: "/games", icon: Gamepad2, label: t("nav.games") },
    { to: "/wallet", icon: Wallet, label: t("nav.wallet") },
    { to: "/missions", icon: Target, label: t("nav.missions") },
    { to: "/profile", icon: UserRound, label: t("nav.profile") },
  ];
  return (
    <nav aria-label={t("nav.bottom")} className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ to, icon: Icon, label }) => (
          <li key={to}>
            <NavLink to={to} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${isActive ? "text-brand-400" : "text-faint"}`}>
              <Icon size={20} aria-hidden="true" />{label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
