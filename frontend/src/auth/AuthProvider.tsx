import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "../lib/api";
import { useI18n, type Locale } from "../i18n";

export interface Me {
  id: string; email: string; username: string; role: "USER" | "ADMIN"; createdAt: string;
  level: { level: number; xp: number; floorXp: number; nextXp: number; progress: number };
  balance: number;
  profile: { displayName: string; avatarColor: string; avatarIcon: string; bio: string; showOnLeaderboard: boolean };
  preferences: {
    locale: Locale; theme: "dark" | "light"; animationIntensity: "FULL" | "REDUCED" | "OFF";
    favoriteCategories: string[]; preferredTags: string[]; difficulty: string;
    personalizationEnabled: boolean; engagementNotifications: boolean; highContrast: boolean; tutorialDone: boolean;
  };
}

interface Ctx {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setMe: (m: Me) => void;
  setBalance: (b: number) => void;
  logout: () => Promise<void>;
}
const AuthCtx = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(AuthCtx);

const THEME_KEY = "zp-theme";

/** Menerapkan preferensi tampilan (tema, gerak, kontras) ke elemen <html>. */
export function applyAppearance(theme: string, motion: string, highContrast: boolean) {
  const el = document.documentElement;
  el.dataset.theme = theme;
  el.dataset.motion = motion === "FULL" ? "full" : motion === "REDUCED" ? "reduced" : "off";
  if (highContrast) el.dataset.contrast = "high"; else delete el.dataset.contrast;
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* abaikan */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMeState] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const { setLocale } = useI18n();

  const apply = useCallback((m: Me | null) => {
    setMeState(m);
    if (m) {
      setLocale(m.preferences.locale);
      applyAppearance(m.preferences.theme, m.preferences.animationIntensity, m.preferences.highContrast);
    }
  }, [setLocale]);

  const refresh = useCallback(async () => {
    try {
      apply(await api.get<Me>("/me"));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMeState(null);
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
    } catch { /* abaikan */ }
    void refresh();
  }, [refresh]);

  const value: Ctx = {
    me, loading, refresh,
    setMe: apply as (m: Me) => void,
    setBalance: (b) => setMeState((m) => (m ? { ...m, balance: b } : m)),
    logout: async () => {
      try { await api.post("/auth/logout"); } catch { /* sesi mungkin sudah habis */ }
      setMeState(null);
    },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
