import { Languages } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { useI18n, type Locale } from "../i18n";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const { me } = useAuth();
  const change = (l: Locale) => {
    setLocale(l);
    if (me) void api.patch("/me/preferences", { locale: l }).catch(() => undefined);
  };
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t("common.language")}</span>
      <Languages size={16} className="pointer-events-none absolute left-2.5 text-faint" aria-hidden="true" />
      <select value={locale} onChange={(e) => change(e.target.value as Locale)}
        className="select !w-auto !rounded-xl !py-1.5 !pl-8 !pr-2 text-sm" aria-label={t("common.language")}>
        <option value="id">Indonesia</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
