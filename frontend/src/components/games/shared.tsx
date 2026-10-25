import { useCallback, useRef, useState } from "react";
import { api, ApiError, newRequestId } from "../../lib/api";
import { useAuth } from "../../auth/AuthProvider";
import { useI18n } from "../../i18n";
import type { GameInfo, RoundView } from "../../lib/types";
import { useToast } from "../Toast";
import { usePlaySession } from "../SessionReminder";
import { CoinIcon } from "../ui";

export interface GameProps { game: GameInfo; }

/** Pemilih taruhan: nilai berasal dari konfigurasi server; server memvalidasi ulang. */
export function StakePicker({ steps, value, onChange, disabled, label }: { steps: number[]; value: number; onChange: (v: number) => void; disabled?: boolean; label: string }) {
  const { n } = useI18n();
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {steps.map((s) => (
        <button key={s} type="button" className="stake-chip num" aria-pressed={value === s} disabled={disabled} onClick={() => onChange(s)}>{n(s)}</button>
      ))}
    </div>
  );
}

export function BalanceBar({ extra }: { extra?: React.ReactNode }) {
  const { me } = useAuth();
  const { t, n } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3">
      <p className="flex items-center gap-2 text-sm"><CoinIcon size={20} /><span className="text-muted">{t("wallet.balance")}</span><strong className="num text-lg">{n(me?.balance ?? 0)}</strong></p>
      {extra}
    </div>
  );
}

/**
 * Hook bersama untuk memulai ronde: id permintaan unik per aksi (idempotensi), menangani error server
 * (saldo kurang, jeda, batas harian, cooldown) dan memperbarui saldo dari jawaban server.
 */
export function useRound(slug: string) {
  const { setBalance } = useAuth();
  const { toastError } = useToast();
  const { refresh } = usePlaySession();
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false);
  const start = useCallback(async (input: unknown): Promise<RoundView | null> => {
    if (inflight.current) return null; // cegah klik ganda
    inflight.current = true; setBusy(true);
    try {
      const r = await api.post<RoundView>(`/games/${slug}/sessions`, { requestId: newRequestId(), input });
      setBalance(r.balance);
      return r;
    } catch (e) {
      toastError(e);
      if (e instanceof ApiError && ["BREAK_ACTIVE", "DAILY_LIMIT_REACHED"].includes(e.code)) refresh();
      return null;
    } finally { inflight.current = false; setBusy(false); }
  }, [slug, setBalance, toastError, refresh]);
  return { start, busy };
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
