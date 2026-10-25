import { Moon, Sun } from "lucide-react";
import { api } from "../lib/api";
import { applyAppearance, useAuth } from "../auth/AuthProvider";
import { useT } from "../i18n";

export function ThemeToggle() {
  const t = useT();
  const { me } = useAuth();
  const current = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
  const toggle = () => {
    const next = current() === "dark" ? "light" : "dark";
    applyAppearance(next, me?.preferences.animationIntensity ?? "FULL", me?.preferences.highContrast ?? false);
    if (me) void api.patch("/me/preferences", { theme: next }).catch(() => undefined);
  };
  return (
    <button onClick={toggle} className="btn btn-ghost !p-2" aria-label={t("common.toggleTheme")} title={t("common.toggleTheme")}>
      <Moon size={18} className="hidden [[data-theme=dark]_&]:block" />
      <Sun size={18} className="block [[data-theme=dark]_&]:hidden" />
    </button>
  );
}
