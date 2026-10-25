import { NavLink, Outlet } from "react-router-dom";
import { Activity, BarChart3, Coins, Gamepad2, LayoutDashboard, ScrollText, Target, Users } from "lucide-react";
import { useT } from "../../i18n";

export function AdminSidebar() {
  const t = useT();
  const items = [
    { to: "/admin", end: true, icon: LayoutDashboard, label: t("admin.nav.overview") },
    { to: "/admin/users", icon: Users, label: t("admin.nav.users") },
    { to: "/admin/games", icon: Gamepad2, label: t("admin.nav.games") },
    { to: "/admin/economy", icon: Coins, label: t("admin.nav.economy") },
    { to: "/admin/missions", icon: Target, label: t("admin.nav.missions") },
    { to: "/admin/analytics", icon: BarChart3, label: t("admin.nav.analytics") },
    { to: "/admin/audit-logs", icon: ScrollText, label: t("admin.nav.audit") },
  ];
  return (
    <nav aria-label={t("admin.nav.label")} className="lg:sticky lg:top-24 lg:self-start">
      <p className="eyebrow mb-3 hidden items-center gap-2 lg:flex"><Activity size={14} />{t("admin.title")}</p>
      <ul className="flex gap-1 overflow-x-auto pb-2 scroll-thin lg:grid lg:overflow-visible lg:pb-0">
        {items.map(({ to, icon: Icon, label, end }) => (
          <li key={to} className="shrink-0">
            <NavLink to={to} end={end} className={({ isActive }) => `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap ${isActive ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-surface-2 hover:text-ink"}`}>
              <Icon size={17} aria-hidden="true" />{label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AdminLayout() {
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <AdminSidebar />
      <div className="min-w-0"><Outlet /></div>
    </div>
  );
}
