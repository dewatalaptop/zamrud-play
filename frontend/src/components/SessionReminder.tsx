import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Coffee, Timer } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { useI18n, useT } from "../i18n";
import { signed } from "../lib/outcome";
import { Modal } from "./ui";

interface Beat {
  sessionSeconds: number; sessionRounds: number; sessionNet: number; todaySeconds: number; reminderMinutes: number; dailyLimitMinutes: number | null;
  breakUntil: string | null; limitReached: boolean;
}
const Ctx = createContext<{ beat: Beat | null; refresh: () => void }>({ beat: null, refresh: () => undefined });
export const usePlaySession = () => useContext(Ctx);

export const fmtDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}j ${m % 60}m` : `${m}m`;
};

/** Detak waktu sisi server tiap 60 dtk saat tab terlihat; server yang menghitung durasi nyata. */
export function PlaySessionProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const [beat, setBeat] = useState<Beat | null>(null);
  const [remindOpen, setRemindOpen] = useState(false);
  const nextAt = useRef<number | null>(null);
  const { t, n } = useI18n();
  const nav = useNavigate();

  const tick = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    try {
      const b = await api.post<Beat>("/auth/heartbeat");
      setBeat(b);
      const interval = b.reminderMinutes * 60;
      if (nextAt.current === null) nextAt.current = Math.floor(b.sessionSeconds / interval + 1) * interval;
      if (b.sessionSeconds >= nextAt.current) setRemindOpen(true);
    } catch { /* jaringan putus: coba lagi pada detak berikutnya */ }
  }, []);

  useEffect(() => {
    if (!me) { setBeat(null); nextAt.current = null; return; }
    void tick();
    const id = setInterval(() => void tick(), 60_000);
    const vis = () => document.visibilityState === "visible" && void tick();
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, [me?.id, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = () => {
    setRemindOpen(false);
    if (beat) nextAt.current = nextAt.current! + beat.reminderMinutes * 60;
    void api.post("/me/events", { type: "BREAK_REMINDER_DISMISSED" }).catch(() => undefined);
  };
  const takeBreak = async () => {
    setRemindOpen(false);
    try { await api.post("/me/responsible-play/break", { minutes: 15 }); } catch { /* abaikan */ }
    void tick();
    nav("/responsible-play");
  };

  return (
    <Ctx.Provider value={{ beat, refresh: () => void tick() }}>
      {children}
      <Modal open={remindOpen && !!beat} onClose={dismiss} title={t("session.reminderTitle")}
        footer={<>
          <button className="btn btn-secondary" onClick={dismiss}>{t("session.continue")}</button>
          <button className="btn btn-primary" onClick={takeBreak}><Coffee size={16} />{t("session.takeBreak")}</button>
        </>}>
        <div className="flex items-start gap-3">
          <Timer className="mt-0.5 text-brand-400" />
          <div className="text-sm text-muted">
            <p>{t("session.reminderBody", { time: fmtDuration(beat?.sessionSeconds ?? 0) })}</p>
            <p className="mt-2 font-semibold">{t("session.reminderStats", { rounds: beat?.sessionRounds ?? 0, net: signed(beat?.sessionNet ?? 0, n) })}</p>
          </div>
        </div>
      </Modal>
    </Ctx.Provider>
  );
}

/** Pewaktu sesi kecil untuk navbar (selalu terlihat saat login). */
export function SessionTimer() {
  const { beat } = usePlaySession();
  const t = useT();
  if (!beat) return null;
  return (
    <span className="chip hidden md:inline-flex" title={t("session.timerHint")}>
      <Timer size={14} aria-hidden="true" /><span className="sr-only">{t("session.timer")}: </span>{fmtDuration(beat.sessionSeconds)}
    </span>
  );
}
