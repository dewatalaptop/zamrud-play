import { Router } from "express";
import { z } from "zod";
import { all, one, run, tx } from "../db";
import { iso } from "../lib/clock";
import { badRequest, conflict, notFound } from "../lib/errors";
import { newId } from "../lib/security";
import { limit, requireUser } from "../middleware/security";
import { getBalance, dailyStatus } from "../services/wallet";
import { evaluateAchievements, incCounter, levelInfo, track, trackMission } from "../services/progress";
import { endBreak, getSettings, takeBreak, updateSettings, todaySeconds } from "../services/responsible";
import { recommendFor } from "../services/recommendations";
import { h, uid } from "./util";

export const meRouter = Router();
meRouter.use(requireUser);

export const CATEGORIES = ["SLOTS", "WHEEL", "CARDS", "DICE"] as const;
export const TAGS = ["luck", "quick", "visual", "classic", "strategy", "cards", "numbers"] as const;

function loadMe(userId: string) {
  const u = one<any>("SELECT id,email,username,role,status,xp,created_at FROM users WHERE id=?", userId)!;
  const p = one<any>("SELECT * FROM user_profiles WHERE user_id=?", userId)!;
  const pr = one<any>("SELECT * FROM user_preferences WHERE user_id=?", userId)!;
  return {
    id: u.id, email: u.email, username: u.username, role: u.role, createdAt: u.created_at,
    level: levelInfo(u.xp),
    balance: getBalance(userId),
    profile: { displayName: p.display_name, avatarColor: p.avatar_color, avatarIcon: p.avatar_icon, bio: p.bio, showOnLeaderboard: !!p.show_on_leaderboard },
    preferences: {
      locale: pr.locale, theme: pr.theme, animationIntensity: pr.animation_intensity,
      favoriteCategories: JSON.parse(pr.favorite_categories), preferredTags: JSON.parse(pr.preferred_tags), difficulty: pr.difficulty,
      personalizationEnabled: !!pr.personalization_enabled, engagementNotifications: !!pr.engagement_notifications,
      highContrast: !!pr.high_contrast, tutorialDone: !!pr.tutorial_done,
    },
  };
}

meRouter.get("/", h((req) => loadMe(uid(req))));

const AVATAR_COLORS = ["emerald", "gold", "sky", "violet", "rose", "slate"] as const;
const AVATAR_ICONS = ["spade", "heart", "diamond", "club", "crown", "star", "dice", "sparkles"] as const;
const ProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(30),
  avatarColor: z.enum(AVATAR_COLORS), avatarIcon: z.enum(AVATAR_ICONS),
  bio: z.string().trim().max(140), showOnLeaderboard: z.boolean(),
}).partial().strict();

meRouter.patch("/profile", limit("profile", 30, 60 * 60_000, "user"), h((req) => {
  const b = ProfileSchema.parse(req.body);
  const id = uid(req);
  tx(() => {
    const cur = one<any>("SELECT * FROM user_profiles WHERE user_id=?", id)!;
    run("UPDATE user_profiles SET display_name=?,avatar_color=?,avatar_icon=?,bio=?,show_on_leaderboard=? WHERE user_id=?",
      b.displayName ?? cur.display_name, b.avatarColor ?? cur.avatar_color, b.avatarIcon ?? cur.avatar_icon,
      b.bio ?? cur.bio, b.showOnLeaderboard === undefined ? cur.show_on_leaderboard : b.showOnLeaderboard ? 1 : 0, id);
    incCounter(id, "profile_updated");
    trackMission(id, "UPDATE_PROFILE");
    evaluateAchievements(id);
  });
  return loadMe(id);
}));

const PrefsSchema = z.object({
  locale: z.enum(["id", "en"]), theme: z.enum(["dark", "light"]),
  animationIntensity: z.enum(["FULL", "REDUCED", "OFF"]),
  favoriteCategories: z.array(z.enum(CATEGORIES)).max(4),
  preferredTags: z.array(z.enum(TAGS)).max(7),
  difficulty: z.enum(["any", "easy", "medium", "hard"]),
  personalizationEnabled: z.boolean(), engagementNotifications: z.boolean(), highContrast: z.boolean(),
}).partial().strict();

meRouter.patch("/preferences", limit("prefs", 60, 60 * 60_000, "user"), h((req) => {
  const b = PrefsSchema.parse(req.body);
  const id = uid(req);
  tx(() => {
    const c = one<any>("SELECT * FROM user_preferences WHERE user_id=?", id)!;
    const bool = (v: boolean | undefined, old: number) => (v === undefined ? old : v ? 1 : 0);
    run(
      `UPDATE user_preferences SET locale=?,theme=?,animation_intensity=?,favorite_categories=?,preferred_tags=?,difficulty=?,
         personalization_enabled=?,engagement_notifications=?,high_contrast=? WHERE user_id=?`,
      b.locale ?? c.locale, b.theme ?? c.theme, b.animationIntensity ?? c.animation_intensity,
      b.favoriteCategories ? JSON.stringify([...new Set(b.favoriteCategories)]) : c.favorite_categories,
      b.preferredTags ? JSON.stringify([...new Set(b.preferredTags)]) : c.preferred_tags,
      b.difficulty ?? c.difficulty, bool(b.personalizationEnabled, c.personalization_enabled),
      bool(b.engagementNotifications, c.engagement_notifications), bool(b.highContrast, c.high_contrast), id
    );
    // Mematikan personalisasi menghapus riwayat perilaku opsional agar sungguh berhenti dipakai.
    if (b.personalizationEnabled === false) run("DELETE FROM user_events WHERE user_id=?", id);
    track(id, "PREFERENCE_UPDATED");
    trackMission(id, "UPDATE_PREFERENCES");
    evaluateAchievements(id);
  });
  return loadMe(id);
}));

/** Reset profil rekomendasi: hapus preferensi eksplisit rekomendasi + riwayat perilaku opsional. */
meRouter.post("/recommendations/reset", h((req) => {
  const id = uid(req);
  tx(() => {
    run("UPDATE user_preferences SET favorite_categories='[]', preferred_tags='[]', difficulty='any' WHERE user_id=?", id);
    run("DELETE FROM user_events WHERE user_id=?", id);
  });
  return loadMe(id);
}));
meRouter.delete("/events", h((req) => {
  const r = run("DELETE FROM user_events WHERE user_id=?", uid(req));
  return { deleted: Number(r.changes) };
}));

meRouter.post("/tutorial", h((req) => {
  const id = uid(req);
  tx(() => {
    run("UPDATE user_preferences SET tutorial_done=1 WHERE user_id=?", id);
    if (!one("SELECT 1 x FROM user_counters WHERE user_id=? AND key='tutorial_done'", id)) incCounter(id, "tutorial_done");
    trackMission(id, "COMPLETE_TUTORIAL");
    evaluateAchievements(id);
  });
}));

// ───── Favorit ─────
meRouter.get("/favorites", h((req) =>
  all<{ slug: string }>("SELECT g.slug FROM user_favorites f JOIN games g ON g.id=f.game_id WHERE f.user_id=?", uid(req)).map((r) => r.slug)
));
meRouter.put("/favorites/:slug", h((req) => {
  const id = uid(req);
  const g = one<{ id: string }>("SELECT id FROM games WHERE slug=?", String(req.params.slug));
  if (!g) throw notFound("GAME_NOT_FOUND");
  tx(() => {
    run("INSERT OR IGNORE INTO user_favorites(user_id,game_id,created_at) VALUES(?,?,?)", id, g.id, iso());
    track(id, "GAME_FAVORITED", g.id);
    evaluateAchievements(id);
  });
}));
meRouter.delete("/favorites/:slug", h((req) => {
  const g = one<{ id: string }>("SELECT id FROM games WHERE slug=?", String(req.params.slug));
  if (!g) throw notFound("GAME_NOT_FOUND");
  run("DELETE FROM user_favorites WHERE user_id=? AND game_id=?", uid(req), g.id);
}));

// ───── Bermain sehat ─────
meRouter.get("/responsible-play", h((req) => ({ ...getSettings(uid(req)), todaySeconds: todaySeconds(uid(req)) })));
meRouter.put("/responsible-play", h((req) => updateSettings(uid(req), req.body)));
meRouter.post("/responsible-play/break", h((req) => {
  const b = z.object({ minutes: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(240), z.literal(1440)]) }).strict().parse(req.body);
  return takeBreak(uid(req), b.minutes);
}));
meRouter.delete("/responsible-play/break", h((req) => endBreak(uid(req))));

// ───── Event klien yang diizinkan ─────
meRouter.post("/events", limit("events", 120, 60_000, "user"), h((req, res) => {
  res.locals.noSync = true;
  const b = z.object({ type: z.enum(["GAME_VIEWED", "BREAK_REMINDER_DISMISSED"]), game: z.string().max(40).optional() }).strict().parse(req.body);
  const g = b.game ? one<{ id: string }>("SELECT id FROM games WHERE slug=?", b.game) : undefined;
  track(uid(req), b.type, g?.id ?? null);
}));

// ───── Dukungan ─────
meRouter.post("/support", limit("support", 5, 60 * 60_000, "user"), h((req) => {
  const b = z.object({ subject: z.string().trim().min(3).max(100), message: z.string().trim().min(10).max(1000) }).strict().parse(req.body);
  const open = one<{ c: number }>("SELECT COUNT(*) c FROM support_requests WHERE user_id=? AND status='OPEN'", uid(req))!.c;
  if (open >= 5) throw conflict("TOO_MANY_OPEN_REQUESTS");
  const id = newId();
  run("INSERT INTO support_requests(id,user_id,subject,message,created_at,updated_at) VALUES(?,?,?,?,?,?)", id, uid(req), b.subject, b.message, iso(), iso());
  return { id };
}));

// ───── Dasbor ─────
meRouter.get("/dashboard", h((req) => {
  const id = uid(req);
  const me = loadMe(id);
  const games = new Map(all<any>("SELECT slug,category,name_id,name_en,desc_id,desc_en,tags FROM games WHERE enabled=1").map((g) => [g.slug, g]));
  const recs = recommendFor(id).slice(0, 4).filter((r) => games.has(r.slug)).map((r) => {
    const g = games.get(r.slug);
    return { ...r, category: g.category, name: { id: g.name_id, en: g.name_en }, description: { id: g.desc_id, en: g.desc_en } };
  });
  const recent = all<any>(
    `SELECT r.session_id, g.slug, g.name_id, g.name_en, r.stake, r.payout, r.net, r.created_at FROM game_results r JOIN games g ON g.id=r.game_id
     WHERE r.user_id=? ORDER BY r.rowid DESC LIMIT 5`, id
  ).map((r) => ({ sessionId: r.session_id, game: r.slug, name: { id: r.name_id, en: r.name_en }, stake: r.stake, payout: r.payout, net: r.net, createdAt: r.created_at }));
  return { me, daily: dailyStatus(id), recommendations: recs, recent, responsible: { ...getSettings(id), todaySeconds: todaySeconds(id) } };
}));

export { badRequest };
