import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Loc } from "../lib/api";

export type Locale = "id" | "en";
type Dict = { [k: string]: string | Dict };

// Berkas terjemahan dipecah per area (src/i18n/<locale>/<area>.json) lalu digabung otomatis.
function load(mods: Record<string, { default: Dict }>): Dict {
  const out: Dict = {};
  for (const [path, m] of Object.entries(mods)) {
    const area = path.split("/").pop()!.replace(".json", "");
    out[area] = m.default;
  }
  return out;
}
export const messages: Record<Locale, Dict> = {
  id: load(import.meta.glob("./id/*.json", { eager: true }) as Record<string, { default: Dict }>),
  en: load(import.meta.glob("./en/*.json", { eager: true }) as Record<string, { default: Dict }>),
};

function lookup(dict: Dict, key: string): string | undefined {
  let cur: string | Dict | undefined = dict;
  for (const part of key.split(".")) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = cur[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const raw = lookup(messages[locale], key) ?? lookup(messages.id, key) ?? key;
  return params ? raw.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`)) : raw;
}

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Pilih teks dari objek dua bahasa milik server (nama game, misi, ...). */
  tl: (o: Loc | undefined) => string;
  n: (v: number) => string;
  date: (iso: string, withTime?: boolean) => string;
}
const I18n = createContext<Ctx>(null as unknown as Ctx);
export const useI18n = () => useContext(I18n);
export const useT = () => useContext(I18n).t;

const KEY = "zp-locale";
const initial = (): Locale => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "id" || v === "en") return v;
  } catch { /* penyimpanan tidak tersedia */ }
  return "id"; // bahasa default: Indonesia
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLoc] = useState<Locale>(initial);
  const setLocale = useCallback((l: Locale) => {
    setLoc(l);
    try { localStorage.setItem(KEY, l); } catch { /* abaikan */ }
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo<Ctx>(() => {
    const tag = locale === "id" ? "id-ID" : "en-US";
    return {
      locale, setLocale,
      t: (k, p) => translate(locale, k, p),
      tl: (o) => (o ? o[locale] ?? o.id : ""),
      n: (v) => new Intl.NumberFormat(tag).format(v),
      date: (iso, withTime = true) =>
        new Intl.DateTimeFormat(tag, withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(iso)),
    };
  }, [locale, setLocale]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}
