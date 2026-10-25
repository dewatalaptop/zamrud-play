import { z } from "zod";
import { all, one, run, tx } from "../db";
import { iso, localDay, startOfLocalDayIso } from "../lib/clock";
import { badRequest, conflict, notFound } from "../lib/errors";
import { newId } from "../lib/security";
import { getEngine } from "../games/registry";
import { applyLedger, getBalance, reconcile } from "./wallet";
import { destroyAllSessions } from "./auth";
import { EconomySchema, getEconomy, setEconomy } from "./settings";
import { MISSION_METRICS } from "./progress";

export function audit(actorId: string, action: string, targetType: string, targetId: string | null, reason?: string | null, meta: Record<string, unknown> = {}) {
  run(
    "INSERT INTO admin_audit_logs(id,actor_id,action,target_type,target_id,reason,meta,created_at) VALUES(?,?,?,?,?,?,?,?)",
    newId(), actorId, action, targetType, targetId, reason ?? null, JSON.stringify(meta), iso()
  );
}

const reasonSchema = z.string().trim().min(5).max(300);
const sinceIso = (days: number) => new Date(Date.parse(startOfLocalDayIso()) - (days - 1) * 86_400_000).toISOString();
export const RangeSchema = z.coerce.number().int().refine((n) => [7, 30, 90].includes(n)).default(30);

// ───────────── Ringkasan & analitik (agregat dari data nyata) ─────────────
export function analytics(days: number) {
  const since = sinceIso(days);
  const todayStart = startOfLocalDayIso();
  const weekStart = sinceIso(7);
  const n = (sql: string, ...p: string[]) => one<{ c: number }>(sql, ...p)!.c;

  const registered = n("SELECT COUNT(*) c FROM users WHERE status<>'DELETED'");
  const activeSince = (iso0: string) =>
    n(`SELECT COUNT(*) c FROM (SELECT user_id FROM session_summaries WHERE last_seen_at>=? UNION SELECT user_id FROM game_results WHERE created_at>=?)`, iso0, iso0);
  const started = n("SELECT COUNT(*) c FROM game_sessions WHERE started_at>=?", since);
  const completed = n("SELECT COUNT(*) c FROM game_results WHERE created_at>=?", since);
  const dur = one<{ a: number | null }>("SELECT AVG(duration_sec) a FROM session_summaries WHERE started_at>=? AND duration_sec>0", since)!.a;
  const metrics = one<{ t: number | null; e: number | null }>("SELECT SUM(total) t, SUM(errors) e FROM api_metrics WHERE day>=?", localDay(new Date(since)))!;
  const coin = (cond: string) => one<{ s: number | null }>(`SELECT SUM(amount) s FROM wallet_transactions WHERE created_at>=? AND ${cond}`, since)!.s ?? 0;

  const byCategory = all<any>(
    "SELECT g.category c, COUNT(*) n FROM game_results r JOIN games g ON g.id=r.game_id WHERE r.created_at>=? GROUP BY g.category ORDER BY n DESC", since
  ).map((r) => ({ category: r.c, rounds: r.n }));
  const byGame = all<any>(
    `SELECT g.slug, g.name_id, g.name_en,
       (SELECT COUNT(*) FROM game_sessions s WHERE s.game_id=g.id AND s.started_at>=?) started,
       (SELECT COUNT(*) FROM game_results r WHERE r.game_id=g.id AND r.created_at>=?) completed,
       (SELECT COUNT(DISTINCT r.user_id) FROM game_results r WHERE r.game_id=g.id AND r.created_at>=?) players
     FROM games g ORDER BY g.sort_order`, since, since, since
  ).map((r) => ({ slug: r.slug, name: { id: r.name_id, en: r.name_en }, started: r.started, completed: r.completed, players: r.players,
    completionRate: r.started ? Math.round((r.completed / r.started) * 1000) / 10 : null }));

  const series = all<any>(
    `SELECT substr(created_at,1,10) d, COUNT(*) rounds FROM game_results WHERE created_at>=? GROUP BY d ORDER BY d`, since
  ).map((r) => ({ day: r.d, rounds: r.rounds }));
  const signups = all<any>(
    `SELECT substr(created_at,1,10) d, COUNT(*) c FROM users WHERE created_at>=? GROUP BY d ORDER BY d`, since
  ).map((r) => ({ day: r.d, signups: r.c }));

  return {
    rangeDays: days,
    registeredUsers: registered,
    newUsers: n("SELECT COUNT(*) c FROM users WHERE created_at>=?", since),
    dailyActiveUsers: activeSince(todayStart),
    weeklyActiveUsers: activeSince(weekStart),
    sessionsStarted: started,
    completedSessions: completed,
    completionRate: started ? Math.round((completed / started) * 1000) / 10 : null,
    avgSessionSeconds: dur === null ? null : Math.round(dur),
    missionCompletions: n("SELECT COUNT(*) c FROM user_mission_progress WHERE completed_at>=?", since),
    coins: {
      issued: coin("amount>0 AND type NOT IN ('GAME_PAYOUT')"),
      staked: -coin("type='GAME_STAKE'"),
      paidOut: coin("type='GAME_PAYOUT'"),
      byType: all<any>("SELECT type, SUM(amount) s, COUNT(*) c FROM wallet_transactions WHERE created_at>=? GROUP BY type", since).map((r) => ({ type: r.type, total: r.s, count: r.c })),
    },
    requests: metrics.t ?? 0,
    serverErrors: metrics.e ?? 0,
    errorRate: metrics.t ? Math.round(((metrics.e ?? 0) / metrics.t) * 10000) / 100 : null,
    byCategory, byGame, rounds: series, signups,
  };
}

// ───────────── Pengguna ─────────────
export function listUsers(q: string, page: number, pageSize = 20) {
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const where = q ? "WHERE (u.email LIKE ? OR u.username LIKE ? OR p.display_name LIKE ?)" : "";
  const params: (string | number)[] = q ? [like, like, like] : [];
  const total = one<{ c: number }>(`SELECT COUNT(*) c FROM users u JOIN user_profiles p ON p.user_id=u.id ${where}`, ...params)!.c;
  const rows = all<any>(
    `SELECT u.id,u.email,u.username,u.role,u.status,u.xp,u.created_at,u.last_login_at,p.display_name,
       COALESCE(w.balance,0) balance, (SELECT COUNT(*) FROM game_results r WHERE r.user_id=u.id) rounds
     FROM users u JOIN user_profiles p ON p.user_id=u.id LEFT JOIN wallets w ON w.user_id=u.id
     ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`, ...params, pageSize, (page - 1) * pageSize
  );
  return {
    total, page, pageSize,
    items: rows.map((r) => ({ id: r.id, email: r.email, username: r.username, displayName: r.display_name, role: r.role, status: r.status,
      xp: r.xp, balance: r.balance, rounds: r.rounds, createdAt: r.created_at, lastLoginAt: r.last_login_at })),
  };
}

export function userDetail(id: string) {
  const u = one<any>("SELECT u.*, p.display_name FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.id=?", id);
  if (!u) throw notFound("USER_NOT_FOUND");
  const agg = one<any>("SELECT COUNT(*) rounds, COALESCE(SUM(stake),0) staked, COALESCE(SUM(payout),0) paid FROM game_results WHERE user_id=?", id)!;
  const tx = all<any>("SELECT type,amount,balance_after,note,created_at FROM wallet_transactions WHERE user_id=? ORDER BY rowid DESC LIMIT 10", id);
  return {
    id: u.id, email: u.email, username: u.username, displayName: u.display_name, role: u.role, status: u.status, xp: u.xp,
    createdAt: u.created_at, lastLoginAt: u.last_login_at, balance: getBalance(id),
    activity: { rounds: agg.rounds, coinsStaked: agg.staked, grossPayouts: agg.paid },
    recentTransactions: tx.map((t) => ({ type: t.type, amount: t.amount, balanceAfter: t.balance_after, note: t.note, createdAt: t.created_at })),
  };
}

export function setUserStatus(actorId: string, id: string, status: "ACTIVE" | "SUSPENDED", reason: string) {
  reasonSchema.parse(reason);
  return tx(() => {
    const u = one<any>("SELECT id,role,status FROM users WHERE id=?", id);
    if (!u) throw notFound("USER_NOT_FOUND");
    if (u.status === "DELETED") throw conflict("USER_DELETED");
    if (u.id === actorId) throw badRequest("CANNOT_MODIFY_SELF");
    if (u.role === "ADMIN") throw badRequest("CANNOT_MODIFY_ADMIN");
    run("UPDATE users SET status=?, updated_at=? WHERE id=?", status, iso(), id);
    if (status === "SUSPENDED") destroyAllSessions(id);
    audit(actorId, status === "SUSPENDED" ? "USER_SUSPEND" : "USER_REACTIVATE", "user", id, reason);
    return { id, status };
  });
}

/** Penyesuaian saldo virtual oleh admin: wajib alasan, tercatat di ledger dan audit. */
export function adjustBalance(actorId: string, id: string, amount: number, reason: string) {
  reasonSchema.parse(reason);
  z.number().int().min(-1_000_000).max(1_000_000).refine((n) => n !== 0).parse(amount);
  return tx(() => {
    if (!one("SELECT 1 x FROM users WHERE id=? AND status<>'DELETED'", id)) throw notFound("USER_NOT_FOUND");
    const r = applyLedger({ userId: id, type: "ADMIN_ADJUSTMENT", amount, key: `admin:${newId()}`, note: reason, meta: { by: actorId } });
    audit(actorId, "BALANCE_ADJUST", "user", id, reason, { amount, balanceAfter: r.balance });
    return { balance: r.balance };
  });
}

export function demoReset(actorId: string, id: string, reason: string) {
  reasonSchema.parse(reason);
  return tx(() => {
    if (!one("SELECT 1 x FROM users WHERE id=? AND status<>'DELETED'", id)) throw notFound("USER_NOT_FOUND");
    const target = getEconomy().startingBalance;
    const delta = target - getBalance(id);
    if (delta === 0) throw conflict("ALREADY_AT_STARTING_BALANCE");
    const r = applyLedger({ userId: id, type: "DEMO_RESET", amount: delta, key: `demoreset:${newId()}`, note: reason, meta: { by: actorId, target } });
    audit(actorId, "DEMO_RESET", "user", id, reason, { delta, balanceAfter: r.balance });
    return { balance: r.balance };
  });
}

// ───────────── Game ─────────────
export function listGamesAdmin() {
  return all<any>("SELECT * FROM games ORDER BY sort_order").map((g) => {
    const versions = all<any>("SELECT version,status,created_at,published_at,config FROM game_configs WHERE game_id=? ORDER BY version DESC", g.id);
    const engine = getEngine(g.slug)!;
    return {
      id: g.id, slug: g.slug, category: g.category, kind: g.kind, enabled: !!g.enabled, activeConfigVersion: g.active_config_version,
      nameId: g.name_id, nameEn: g.name_en, descId: g.desc_id, descEn: g.desc_en,
      versions: versions.map((v) => ({ version: v.version, status: v.status, createdAt: v.created_at, publishedAt: v.published_at, config: JSON.parse(v.config),
        preview: (() => { const c = engine.validateConfig(JSON.parse(v.config)); return c.ok ? engine.describe(c.config) : null; })() })),
    };
  });
}

export const GameMetaSchema = z.object({
  nameId: z.string().trim().min(2).max(60).optional(), nameEn: z.string().trim().min(2).max(60).optional(),
  descId: z.string().trim().min(5).max(300).optional(), descEn: z.string().trim().min(5).max(300).optional(),
  enabled: z.boolean().optional(),
}).strict();

export function updateGameMeta(actorId: string, gameId: string, raw: unknown) {
  const m = GameMetaSchema.parse(raw);
  return tx(() => {
    const g = one<any>("SELECT * FROM games WHERE id=?", gameId);
    if (!g) throw notFound("GAME_NOT_FOUND");
    run(
      "UPDATE games SET name_id=?,name_en=?,desc_id=?,desc_en=?,enabled=?,updated_at=? WHERE id=?",
      m.nameId ?? g.name_id, m.nameEn ?? g.name_en, m.descId ?? g.desc_id, m.descEn ?? g.desc_en, m.enabled === undefined ? g.enabled : m.enabled ? 1 : 0, iso(), gameId
    );
    audit(actorId, "GAME_UPDATE", "game", gameId, null, m as Record<string, unknown>);
  });
}

export function validateGameConfig(gameId: string, config: unknown) {
  const g = one<any>("SELECT slug FROM games WHERE id=?", gameId);
  if (!g) throw notFound("GAME_NOT_FOUND");
  const engine = getEngine(g.slug)!;
  const c = engine.validateConfig(config);
  return c.ok ? { ok: true as const, preview: engine.describe(c.config), config: c.config } : { ok: false as const, errors: c.errors };
}

export function createDraft(actorId: string, gameId: string, config: unknown) {
  return tx(() => {
    const v = validateGameConfig(gameId, config);
    if (!v.ok) throw badRequest("CONFIG_INVALID", { errors: v.errors });
    const next = one<{ v: number }>("SELECT COALESCE(MAX(version),0)+1 v FROM game_configs WHERE game_id=?", gameId)!.v;
    run("INSERT INTO game_configs(id,game_id,version,config,status,created_at) VALUES(?,?,?,?, 'DRAFT', ?)", newId(), gameId, next, JSON.stringify(v.config), iso());
    audit(actorId, "CONFIG_DRAFT", "game", gameId, null, { version: next });
    return { version: next, preview: v.preview };
  });
}

export function publishConfig(actorId: string, gameId: string, version: number, reason: string) {
  reasonSchema.parse(reason);
  return tx(() => {
    const row = one<any>("SELECT config,status FROM game_configs WHERE game_id=? AND version=?", gameId, version);
    if (!row) throw notFound("CONFIG_NOT_FOUND");
    if (row.status !== "DRAFT") throw conflict("CONFIG_NOT_DRAFT");
    const v = validateGameConfig(gameId, JSON.parse(row.config)); // validasi ulang sebelum terbit
    if (!v.ok) throw badRequest("CONFIG_INVALID", { errors: v.errors });
    run("UPDATE game_configs SET status='RETIRED' WHERE game_id=? AND status='PUBLISHED'", gameId);
    run("UPDATE game_configs SET status='PUBLISHED', published_at=? WHERE game_id=? AND version=?", iso(), gameId, version);
    run("UPDATE games SET active_config_version=?, updated_at=? WHERE id=?", version, iso(), gameId);
    audit(actorId, "CONFIG_PUBLISH", "game", gameId, reason, { version });
    return { activeConfigVersion: version };
  });
}

// ───────────── Misi ─────────────
export const MissionSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9-]{3,40}$/),
  period: z.enum(["DAILY", "WEEKLY", "ONCE"]),
  metric: z.enum(MISSION_METRICS),
  target: z.number().int().min(1).max(20),
  rewardCoins: z.number().int().min(0).max(10_000),
  titleId: z.string().trim().min(3).max(80), titleEn: z.string().trim().min(3).max(80),
  descId: z.string().trim().min(3).max(240), descEn: z.string().trim().min(3).max(240),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(50),
}).strict();

export function listMissionsAdmin() {
  return all<any>("SELECT * FROM missions ORDER BY sort_order, created_at").map((m) => ({
    id: m.id, key: m.key, period: m.period, metric: m.metric, target: m.target, rewardCoins: m.reward_coins, active: !!m.active, sortOrder: m.sort_order,
    titleId: m.title_id, titleEn: m.title_en, descId: m.desc_id, descEn: m.desc_en,
    completions: one<{ c: number }>("SELECT COUNT(*) c FROM user_mission_progress WHERE mission_id=? AND completed_at IS NOT NULL", m.id)!.c,
  }));
}

export function createMission(actorId: string, raw: unknown) {
  const m = MissionSchema.parse(raw);
  return tx(() => {
    if (one("SELECT 1 x FROM missions WHERE key=?", m.key)) throw conflict("MISSION_KEY_TAKEN");
    const id = newId(), at = iso();
    run(
      `INSERT INTO missions(id,key,period,metric,target,reward_coins,title_id,title_en,desc_id,desc_en,active,sort_order,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, m.key, m.period, m.metric, m.target, m.rewardCoins, m.titleId, m.titleEn, m.descId, m.descEn, m.active ? 1 : 0, m.sortOrder, at, at
    );
    audit(actorId, "MISSION_CREATE", "mission", id, null, { key: m.key });
    return { id };
  });
}

export function updateMission(actorId: string, id: string, raw: unknown) {
  const m = MissionSchema.omit({ key: true }).partial().parse(raw);
  return tx(() => {
    const cur = one<any>("SELECT * FROM missions WHERE id=?", id);
    if (!cur) throw notFound("MISSION_NOT_FOUND");
    run(
      `UPDATE missions SET period=?,metric=?,target=?,reward_coins=?,title_id=?,title_en=?,desc_id=?,desc_en=?,active=?,sort_order=?,updated_at=? WHERE id=?`,
      m.period ?? cur.period, m.metric ?? cur.metric, m.target ?? cur.target, m.rewardCoins ?? cur.reward_coins,
      m.titleId ?? cur.title_id, m.titleEn ?? cur.title_en, m.descId ?? cur.desc_id, m.descEn ?? cur.desc_en,
      m.active === undefined ? cur.active : m.active ? 1 : 0, m.sortOrder ?? cur.sort_order, iso(), id
    );
    audit(actorId, "MISSION_UPDATE", "mission", id, null, m as Record<string, unknown>);
  });
}

// ───────────── Ekonomi & promo ─────────────
export function updateEconomy(actorId: string, raw: unknown, reason: string) {
  reasonSchema.parse(reason);
  const next = EconomySchema.parse(raw);
  return tx(() => {
    const before = getEconomy();
    setEconomy(next);
    audit(actorId, "ECONOMY_UPDATE", "settings", "economy", reason, { before, after: next });
    return next;
  });
}

export const PromoSchema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9-]{4,24}$/),
  rewardCoins: z.number().int().min(1).max(10_000),
  maxRedemptions: z.number().int().min(1).max(100_000),
  expiresAt: z.string().datetime().nullable().default(null),
}).strict();

export function listPromos() {
  return all<any>("SELECT * FROM promo_codes ORDER BY created_at DESC").map((p) => ({
    id: p.id, code: p.code, rewardCoins: p.reward_coins, maxRedemptions: p.max_redemptions, redeemed: p.redeemed_count, expiresAt: p.expires_at, active: !!p.active,
  }));
}
export function createPromo(actorId: string, raw: unknown) {
  const p = PromoSchema.parse(raw);
  return tx(() => {
    if (one("SELECT 1 x FROM promo_codes WHERE code=?", p.code)) throw conflict("PROMO_CODE_TAKEN");
    const id = newId();
    run("INSERT INTO promo_codes(id,code,reward_coins,max_redemptions,expires_at,created_at) VALUES(?,?,?,?,?,?)", id, p.code, p.rewardCoins, p.maxRedemptions, p.expiresAt, iso());
    audit(actorId, "PROMO_CREATE", "promo", id, null, { code: p.code });
    return { id };
  });
}
export function setPromoActive(actorId: string, id: string, active: boolean) {
  const r = run("UPDATE promo_codes SET active=? WHERE id=?", active ? 1 : 0, id);
  if (!Number(r.changes)) throw notFound("PROMO_NOT_FOUND");
  audit(actorId, active ? "PROMO_ENABLE" : "PROMO_DISABLE", "promo", id);
}

export function economyOverview() {
  return { economy: getEconomy(), inconsistencies: reconcile(), promos: listPromos() };
}

// ───────────── Audit & dukungan ─────────────
export function listAudit(page: number, pageSize = 25) {
  const total = one<{ c: number }>("SELECT COUNT(*) c FROM admin_audit_logs")!.c;
  const rows = all<any>(
    `SELECT a.*, u.username actor FROM admin_audit_logs a JOIN users u ON u.id=a.actor_id ORDER BY a.rowid DESC LIMIT ? OFFSET ?`, pageSize, (page - 1) * pageSize
  );
  return { total, page, pageSize, items: rows.map((r) => ({ id: r.id, actor: r.actor, action: r.action, targetType: r.target_type, targetId: r.target_id, reason: r.reason, meta: JSON.parse(r.meta), createdAt: r.created_at })) };
}

export function listSupport(status: string | null) {
  return all<any>(
    `SELECT s.*, u.username FROM support_requests s JOIN users u ON u.id=s.user_id ${status ? "WHERE s.status=?" : ""} ORDER BY s.created_at DESC LIMIT 100`,
    ...(status ? [status] : [])
  ).map((r) => ({ id: r.id, username: r.username, subject: r.subject, message: r.message, status: r.status, adminNote: r.admin_note, createdAt: r.created_at }));
}
export function resolveSupport(actorId: string, id: string, note: string) {
  const r = run("UPDATE support_requests SET status='RESOLVED', admin_note=?, updated_at=? WHERE id=?", note.slice(0, 500), iso(), id);
  if (!Number(r.changes)) throw notFound("SUPPORT_NOT_FOUND");
  audit(actorId, "SUPPORT_RESOLVE", "support", id, note.slice(0, 200));
}
