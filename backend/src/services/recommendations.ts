import { all, one } from "../db";

export interface RecGame { slug: string; category: string; tags: string[]; difficulty: string; sortOrder: number; }
export interface RecInput {
  games: RecGame[];
  prefs: { favoriteCategories: string[]; preferredTags: string[]; difficulty: string };
  favorites: string[];
  recent: string[]; // slug terbaru lebih dulu
  playCount: Record<string, number>;
  personalization: boolean;
}
export interface Recommendation { slug: string; score: number; reason: { key: string; params: Record<string, string> }; }

/**
 * Rekomendasi transparan: skor dari preferensi eksplisit, favorit, riwayat singkat, keragaman, dan eksplorasi.
 * TIDAK pernah memakai kekalahan/saldo/lama bermain, dan tidak mengubah odds/payout game apa pun.
 */
export function rank(input: RecInput): Recommendation[] {
  const games = input.games.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  if (!input.personalization) {
    return games.map((g) => ({ slug: g.slug, score: 0, reason: { key: "rec.default", params: {} } }));
  }
  const scored = games.map((g) => {
    let score = 0;
    let reason: Recommendation["reason"] = { key: "rec.default", params: {} };
    const set = (r: Recommendation["reason"], pts: number) => {
      score += pts;
      if (pts >= 2 && reason.key === "rec.default") reason = r;
    };
    if (input.prefs.favoriteCategories.includes(g.category)) set({ key: "rec.favoriteCategory", params: { category: g.category } }, 3);
    const tag = g.tags.find((t) => input.prefs.preferredTags.includes(t));
    if (tag) set({ key: "rec.preferredTag", params: { tag } }, 2);
    if (input.favorites.includes(g.slug)) set({ key: "rec.favorite", params: {} }, 2);
    const count = input.playCount[g.slug] ?? 0;
    if (count >= 3) set({ key: "rec.playedOften", params: {} }, 1);
    if (input.prefs.difficulty !== "any" && input.prefs.difficulty === g.difficulty) score += 1;
    const idx = input.recent.indexOf(g.slug);
    if (idx >= 0 && idx < 2) score -= 1; // keragaman: jangan terus mengulang game yang baru dimainkan
    return { g, score, reason, count };
  });
  const unplayed = scored.filter((x) => x.count === 0).sort((a, b) => b.score - a.score)[0];
  const out = scored.map((x) => {
    if (unplayed && x.g.slug === unplayed.g.slug) {
      return { slug: x.g.slug, score: x.score + 1, reason: x.reason.key === "rec.default" ? { key: "rec.explore", params: {} } : x.reason };
    }
    return { slug: x.g.slug, score: x.score, reason: x.reason };
  });
  return out.sort((a, b) => b.score - a.score);
}

export function recommendFor(userId: string): Recommendation[] {
  const rows = all<any>("SELECT slug,category,tags,difficulty,sort_order FROM games WHERE enabled=1");
  const games: RecGame[] = rows.map((r) => ({ slug: r.slug, category: r.category, tags: JSON.parse(r.tags), difficulty: r.difficulty, sortOrder: r.sort_order }));
  const p = one<any>("SELECT * FROM user_preferences WHERE user_id=?", userId);
  const personalization = (p?.personalization_enabled ?? 1) === 1;
  const favorites = all<{ slug: string }>("SELECT g.slug FROM user_favorites f JOIN games g ON g.id=f.game_id WHERE f.user_id=?", userId).map((r) => r.slug);
  const recent = all<{ slug: string }>(
    "SELECT g.slug FROM game_results r JOIN games g ON g.id=r.game_id WHERE r.user_id=? ORDER BY r.rowid DESC LIMIT 6", userId
  ).map((r) => r.slug);
  const playCount: Record<string, number> = {};
  for (const r of all<{ slug: string; c: number }>("SELECT g.slug, COUNT(*) c FROM game_results r JOIN games g ON g.id=r.game_id WHERE r.user_id=? GROUP BY g.slug", userId)) playCount[r.slug] = r.c;
  return rank({
    games,
    prefs: {
      favoriteCategories: JSON.parse(p?.favorite_categories ?? "[]"),
      preferredTags: JSON.parse(p?.preferred_tags ?? "[]"),
      difficulty: p?.difficulty ?? "any",
    },
    favorites, recent, playCount, personalization,
  });
}
