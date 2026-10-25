import { z } from "zod";
import { one, run, tx } from "../db";
import { iso, now, startOfLocalDayIso } from "../lib/clock";
import { forbidden, HttpError } from "../lib/errors";
import { newId } from "../lib/security";
import { track } from "./progress";

export const ResponsibleSchema = z.object({
  // Pengingat tidak bisa dimatikan: hanya diatur 10–180 menit (default 30).
  reminderMinutes: z.number().int().min(10).max(180),
  dailyLimitMinutes: z.number().int().min(10).max(720).nullable(),
  cooldownSeconds: z.number().int().min(0).max(300),
}).strict();

const IDLE_MS = 10 * 60_000; // jeda tanpa detak > 10 menit = sesi baru
const MAX_TICK_SEC = 90;

export function ensureSettings(userId: string) {
  run("INSERT OR IGNORE INTO responsible_settings(user_id) VALUES(?)", userId);
}

export function getSettings(userId: string) {
  ensureSettings(userId);
  const r = one<any>("SELECT * FROM responsible_settings WHERE user_id=?", userId)!;
  const breakActive = r.break_until && r.break_until > iso();
  return {
    reminderMinutes: r.reminder_minutes as number,
    dailyLimitMinutes: r.daily_limit_minutes as number | null,
    cooldownSeconds: r.cooldown_seconds as number,
    breakUntil: breakActive ? (r.break_until as string) : null,
  };
}

export function updateSettings(userId: string, raw: unknown) {
  const s = ResponsibleSchema.parse(raw);
  ensureSettings(userId);
  run(
    "UPDATE responsible_settings SET reminder_minutes=?, daily_limit_minutes=?, cooldown_seconds=? WHERE user_id=?",
    s.reminderMinutes, s.dailyLimitMinutes, s.cooldownSeconds, userId
  );
  return getSettings(userId);
}

/** Jeda sukarela. Tidak pernah dihukum: tidak mempengaruhi hadiah, misi, atau lencana. */
export function takeBreak(userId: string, minutes: number) {
  const until = new Date(now().getTime() + minutes * 60_000).toISOString();
  ensureSettings(userId);
  run("UPDATE responsible_settings SET break_until=? WHERE user_id=?", until, userId);
  endOpenSession(userId);
  return getSettings(userId);
}

export function endBreak(userId: string) {
  run("UPDATE responsible_settings SET break_until=NULL WHERE user_id=?", userId);
  return getSettings(userId);
}

export function todaySeconds(userId: string): number {
  return one<{ s: number }>(
    "SELECT COALESCE(SUM(duration_sec),0) s FROM session_summaries WHERE user_id=? AND started_at>=?", userId, startOfLocalDayIso()
  )!.s;
}

/** Dipanggil sebelum ronde BARU dimulai (ronde berjalan tetap boleh diselesaikan). */
export function assertCanStartRound(userId: string) {
  const s = getSettings(userId);
  if (s.breakUntil) throw forbidden("BREAK_ACTIVE");
  if (s.dailyLimitMinutes !== null && todaySeconds(userId) >= s.dailyLimitMinutes * 60) throw forbidden("DAILY_LIMIT_REACHED");
  if (s.cooldownSeconds > 0) {
    const last = one<{ t: string | null }>("SELECT last_round_at t FROM responsible_settings WHERE user_id=?", userId)?.t;
    if (last) {
      const wait = Date.parse(last) + s.cooldownSeconds * 1000 - now().getTime();
      if (wait > 0) throw new HttpError(429, "COOLDOWN_ACTIVE", "COOLDOWN_ACTIVE", { retryAfterMs: wait });
    }
  }
}

export function markRoundEnded(userId: string) {
  ensureSettings(userId);
  run("UPDATE responsible_settings SET last_round_at=? WHERE user_id=?", iso(), userId);
  run(
    "UPDATE session_summaries SET games_played=games_played+1 WHERE id=(SELECT id FROM session_summaries WHERE user_id=? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1)",
    userId
  );
}

function endOpenSession(userId: string) {
  const open = one<{ id: string; last_seen_at: string }>(
    "SELECT id,last_seen_at FROM session_summaries WHERE user_id=? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1", userId
  );
  if (open) {
    run("UPDATE session_summaries SET ended_at=? WHERE id=?", open.last_seen_at, open.id);
    track(userId, "SESSION_ENDED");
  }
}

/** Detak waktu sisi server: menambah durasi hanya sebesar selisih nyata (maks 90 dtk per detak). */
export function heartbeat(userId: string) {
  return tx(() => {
    const t = now();
    const open = one<any>(
      "SELECT * FROM session_summaries WHERE user_id=? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1", userId
    );
    let sessionSeconds = 0;
    if (open && t.getTime() - Date.parse(open.last_seen_at) <= IDLE_MS) {
      const dt = Math.min(MAX_TICK_SEC, Math.max(0, Math.round((t.getTime() - Date.parse(open.last_seen_at)) / 1000)));
      sessionSeconds = open.duration_sec + dt;
      run("UPDATE session_summaries SET duration_sec=?, last_seen_at=? WHERE id=?", sessionSeconds, iso(t), open.id);
    } else {
      if (open) {
        run("UPDATE session_summaries SET ended_at=? WHERE id=?", open.last_seen_at, open.id);
        track(userId, "SESSION_ENDED");
      }
      run("INSERT INTO session_summaries(id,user_id,started_at,last_seen_at) VALUES(?,?,?,?)", newId(), userId, iso(t), iso(t));
      track(userId, "SESSION_STARTED");
    }
    const settings = getSettings(userId);
    const today = todaySeconds(userId);
    return {
      sessionSeconds,
      todaySeconds: today,
      reminderMinutes: settings.reminderMinutes,
      dailyLimitMinutes: settings.dailyLimitMinutes,
      breakUntil: settings.breakUntil,
      limitReached: settings.dailyLimitMinutes !== null && today >= settings.dailyLimitMinutes * 60,
    };
  });
}
