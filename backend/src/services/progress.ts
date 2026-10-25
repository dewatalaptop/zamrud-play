import { all, one, run, tx } from "../db";
import { iso, localDay, localWeekKey, startOfLocalDayIso } from "../lib/clock";
import { conflict, notFound } from "../lib/errors";
import { newId } from "../lib/security";
import { applyLedger } from "./wallet";
import { getEconomy } from "./settings";

// ───────────── Event perilaku (opsional, hanya untuk penemuan game) ─────────────
export const EVENT_TYPES = [
  "GAME_VIEWED", "GAME_STARTED", "GAME_COMPLETED", "GAME_FAVORITED", "MISSION_COMPLETED",
  "SESSION_STARTED", "SESSION_ENDED", "PREFERENCE_UPDATED", "BREAK_REMINDER_DISMISSED",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export function personalizationOn(userId: string): boolean {
  return (one<{ p: number }>("SELECT personalization_enabled p FROM user_preferences WHERE user_id=?", userId)?.p ?? 1) === 1;
}

/** Hanya mencatat bila pemain mengizinkan personalisasi. Tidak pernah menyimpan data sensitif. */
export function track(userId: string, type: EventType, gameId?: string | null, meta: Record<string, unknown> = {}) {
  if (!personalizationOn(userId)) return;
  run("INSERT INTO user_events(id,user_id,type,game_id,meta,created_at) VALUES(?,?,?,?,?,?)", newId(), userId, type, gameId ?? null, JSON.stringify(meta), iso());
}

// ───────────── Counter & XP ─────────────
export function incCounter(userId: string, key: string, by = 1) {
  run(
    "INSERT INTO user_counters(user_id,key,value) VALUES(?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET value=value+excluded.value",
    userId, key, by
  );
}
export const getCounter = (userId: string, key: string) =>
  one<{ value: number }>("SELECT value FROM user_counters WHERE user_id=? AND key=?", userId, key)?.value ?? 0;

export function addXp(userId: string, amount: number) {
  if (amount > 0) run("UPDATE users SET xp=xp+?, updated_at=? WHERE id=?", amount, iso(), userId);
}

/** Level = floor(sqrt(xp/50)) + 1. XP hanya penanda kemajuan, bukan nilai uang. */
export function levelInfo(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  const floorXp = 50 * (level - 1) ** 2;
  const nextXp = 50 * level ** 2;
  return { level, xp, floorXp, nextXp, progress: (xp - floorXp) / (nextXp - floorXp) };
}

/** XP per ronde dibatasi per hari agar tidak mendorong bermain terus-menerus. */
export function awardRoundXp(userId: string) {
  const eco = getEconomy();
  if (eco.xpPerRound <= 0) return;
  const key = `xp_round:${localDay()}`;
  const used = getCounter(userId, key);
  const grant = Math.min(eco.xpPerRound, Math.max(0, eco.xpPerRoundDailyCap - used));
  if (grant > 0) {
    incCounter(userId, key, grant);
    addXp(userId, grant);
  }
}

// ───────────── Misi ─────────────
export const MISSION_METRICS = [
  "COMPLETE_SESSION", "DISTINCT_GAMES", "DISTINCT_CATEGORIES", "REVIEW_RULES",
  "COMPLETE_TUTORIAL", "UPDATE_PREFERENCES", "UPDATE_PROFILE", "CLAIM_DAILY",
] as const;
export type MissionMetric = (typeof MISSION_METRICS)[number];
const DISTINCT = new Set<string>(["DISTINCT_GAMES", "DISTINCT_CATEGORIES", "REVIEW_RULES"]);

export function periodKeyFor(period: string): string {
  return period === "DAILY" ? localDay() : period === "WEEKLY" ? localWeekKey() : "once";
}

interface MissionRow {
  id: string; key: string; period: string; metric: string; target: number; reward_coins: number;
  title_id: string; title_en: string; desc_id: string; desc_en: string; active: number; sort_order: number;
}

/** Memajukan misi aktif bertipe `metric`. `value` = kunci unik (slug/kategori) untuk metrik distinct. */
export function trackMission(userId: string, metric: MissionMetric, value?: string) {
  const missions = all<MissionRow>("SELECT * FROM missions WHERE active=1 AND metric=?", metric);
  for (const m of missions) {
    const pk = periodKeyFor(m.period);
    const row = one<{ progress: number; data: string; completed_at: string | null }>(
      "SELECT progress,data,completed_at FROM user_mission_progress WHERE user_id=? AND mission_id=? AND period_key=?",
      userId, m.id, pk
    );
    if (row?.completed_at) continue;
    let progress = row?.progress ?? 0;
    let data: string[] = row ? JSON.parse(row.data) : [];
    if (DISTINCT.has(metric)) {
      if (!value || data.includes(value)) continue;
      data.push(value);
      progress = data.length;
    } else {
      progress += 1;
    }
    const completed = progress >= m.target;
    const at = completed ? iso() : null;
    run(
      `INSERT INTO user_mission_progress(user_id,mission_id,period_key,progress,data,completed_at) VALUES(?,?,?,?,?,?)
       ON CONFLICT(user_id,mission_id,period_key) DO UPDATE SET progress=excluded.progress, data=excluded.data, completed_at=excluded.completed_at`,
      userId, m.id, pk, Math.min(progress, m.target), JSON.stringify(data), at
    );
    if (completed) track(userId, "MISSION_COMPLETED", null, { mission: m.key });
  }
}

export function listMissions(userId: string) {
  const missions = all<MissionRow>("SELECT * FROM missions WHERE active=1 ORDER BY sort_order, created_at");
  const out: any[] = [];
  for (const m of missions) {
    const pk = periodKeyFor(m.period);
    const row = one<any>("SELECT * FROM user_mission_progress WHERE user_id=? AND mission_id=? AND period_key=?", userId, m.id, pk);
    out.push(shapeMission(m, pk, row));
  }
  // Hadiah periode lalu yang selesai tapi belum diklaim tetap bisa diklaim (tidak ada hukuman).
  const pending = all<any>(
    `SELECT p.*, m.* , p.period_key pk FROM user_mission_progress p JOIN missions m ON m.id=p.mission_id
     WHERE p.user_id=? AND p.completed_at IS NOT NULL AND p.claimed_at IS NULL AND m.active=1`, userId
  );
  for (const r of pending) {
    if (r.pk === periodKeyFor(r.period)) continue;
    out.push(shapeMission(r as MissionRow, r.pk, r));
  }
  return out;
}

function shapeMission(m: MissionRow, pk: string, row?: any) {
  return {
    id: m.id, key: m.key, period: m.period, metric: m.metric, target: m.target, rewardCoins: m.reward_coins,
    title: { id: m.title_id, en: m.title_en }, description: { id: m.desc_id, en: m.desc_en },
    periodKey: pk, progress: row?.progress ?? 0, completed: !!row?.completed_at, claimed: !!row?.claimed_at,
  };
}

export function claimMission(userId: string, missionId: string, periodKey: string): { balance: number; amount: number } {
  return tx(() => {
    const m = one<MissionRow>("SELECT * FROM missions WHERE id=?", missionId);
    if (!m) throw notFound("MISSION_NOT_FOUND");
    const row = one<{ completed_at: string | null; claimed_at: string | null }>(
      "SELECT completed_at,claimed_at FROM user_mission_progress WHERE user_id=? AND mission_id=? AND period_key=?", userId, missionId, periodKey
    );
    if (!row || !row.completed_at) throw conflict("MISSION_NOT_COMPLETE");
    if (row.claimed_at) throw conflict("ALREADY_CLAIMED");
    const key = `mission:${userId}:${missionId}:${periodKey}`;
    let balance: number;
    if (m.reward_coins > 0) {
      const r = applyLedger({ userId, type: "MISSION_REWARD", amount: m.reward_coins, key, meta: { mission: m.key, periodKey } });
      if (r.duplicate) throw conflict("ALREADY_CLAIMED");
      balance = r.balance;
    } else {
      balance = one<{ balance: number }>("SELECT balance FROM wallets WHERE user_id=?", userId)!.balance;
    }
    run("UPDATE user_mission_progress SET claimed_at=? WHERE user_id=? AND mission_id=? AND period_key=?", iso(), userId, missionId, periodKey);
    addXp(userId, getEconomy().xpPerMission);
    evaluateAchievements(userId);
    return { balance, amount: m.reward_coins };
  });
}

// ───────────── Pencapaian (lencana non-moneter) ─────────────
export const ACHIEVEMENT_METRICS = [
  "GAMES_PLAYED", "DISTINCT_GAMES", "DISTINCT_CATEGORIES", "STRATEGY_ROUNDS",
  "STATS_VIEWED", "RULES_REVIEWED", "FAVORITES", "PROFILE_UPDATED", "TUTORIAL_DONE",
] as const;

export function metricValue(userId: string, metric: string): number {
  const n = (sql: string, ...p: string[]) => one<{ c: number }>(sql, ...p)?.c ?? 0;
  switch (metric) {
    case "GAMES_PLAYED": return n("SELECT COUNT(*) c FROM game_results WHERE user_id=?", userId);
    case "DISTINCT_GAMES": return n("SELECT COUNT(DISTINCT game_id) c FROM game_results WHERE user_id=?", userId);
    case "DISTINCT_CATEGORIES":
      return n("SELECT COUNT(DISTINCT g.category) c FROM game_results r JOIN games g ON g.id=r.game_id WHERE r.user_id=?", userId);
    case "STRATEGY_ROUNDS":
      return n(`SELECT COUNT(*) c FROM game_results r JOIN games g ON g.id=r.game_id WHERE r.user_id=? AND g.tags LIKE '%"strategy"%'`, userId);
    case "STATS_VIEWED": return getCounter(userId, "stats_viewed");
    case "RULES_REVIEWED": return n("SELECT COUNT(*) c FROM user_counters WHERE user_id=? AND key LIKE 'rules:%'", userId);
    case "FAVORITES": return n("SELECT COUNT(*) c FROM user_favorites WHERE user_id=?", userId);
    case "PROFILE_UPDATED": return getCounter(userId, "profile_updated");
    case "TUTORIAL_DONE": return getCounter(userId, "tutorial_done");
    default: return 0;
  }
}

/** Membuka lencana yang syaratnya terpenuhi. Mengembalikan daftar kunci yang baru terbuka. */
export function evaluateAchievements(userId: string): string[] {
  const unlocked: string[] = [];
  const defs = all<any>(
    "SELECT a.* FROM achievements a WHERE a.id NOT IN (SELECT achievement_id FROM user_achievements WHERE user_id=?)", userId
  );
  for (const a of defs) {
    if (metricValue(userId, a.metric) >= a.threshold) {
      const r = run("INSERT OR IGNORE INTO user_achievements(user_id,achievement_id,unlocked_at) VALUES(?,?,?)", userId, a.id, iso());
      if (Number(r.changes) === 1) {
        addXp(userId, getEconomy().xpPerAchievement);
        unlocked.push(a.key);
      }
    }
  }
  return unlocked;
}

export function listAchievements(userId: string) {
  const defs = all<any>("SELECT * FROM achievements ORDER BY sort_order");
  const got = new Map(all<any>("SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id=?", userId).map((r) => [r.achievement_id, r.unlocked_at]));
  return defs.map((a) => {
    const value = metricValue(userId, a.metric);
    return {
      id: a.id, key: a.key, icon: a.icon, metric: a.metric, threshold: a.threshold,
      name: { id: a.name_id, en: a.name_en }, description: { id: a.desc_id, en: a.desc_en },
      progress: Math.min(value, a.threshold), unlockedAt: got.get(a.id) ?? null,
    };
  });
}

export function xpToday(userId: string) {
  return getCounter(userId, `xp_round:${localDay()}`);
}
export { startOfLocalDayIso };
