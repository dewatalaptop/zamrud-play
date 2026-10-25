import { all, one } from "../db";
import { startOfLocalDayIso } from "../lib/clock";
import { levelInfo, listAchievements } from "./progress";

/** Statistik pribadi — murni dihitung dari catatan nyata. Istilah netral: koin virtual, bukan penghasilan. */
export function getStatistics(userId: string) {
  const totals = one<any>(
    "SELECT COUNT(*) games, COALESCE(SUM(stake),0) staked, COALESCE(SUM(payout),0) payouts, COALESCE(SUM(net),0) net FROM game_results WHERE user_id=?", userId
  )!;
  const rewards = one<any>(
    "SELECT COALESCE(SUM(amount),0) s FROM wallet_transactions WHERE user_id=? AND type IN ('DAILY_REWARD','MISSION_REWARD','PROMO_REWARD')", userId
  )!.s;
  const byCategory = all<any>(
    "SELECT g.category, COUNT(*) c FROM game_results r JOIN games g ON g.id=r.game_id WHERE r.user_id=? GROUP BY g.category ORDER BY c DESC", userId
  ).map((r) => ({ category: r.category, count: r.c }));
  const byGame = all<any>(
    `SELECT g.slug, g.name_id, g.name_en, COUNT(*) c, COALESCE(SUM(r.net),0) net FROM game_results r JOIN games g ON g.id=r.game_id
     WHERE r.user_id=? GROUP BY g.id ORDER BY c DESC`, userId
  ).map((r) => ({ slug: r.slug, name: { id: r.name_id, en: r.name_en }, count: r.c, net: r.net }));
  const recent = all<any>(
    `SELECT r.session_id, g.slug, g.name_id, g.name_en, r.stake, r.payout, r.net, r.created_at FROM game_results r JOIN games g ON g.id=r.game_id
     WHERE r.user_id=? ORDER BY r.rowid DESC LIMIT 8`, userId
  ).map((r) => ({ sessionId: r.session_id, game: r.slug, name: { id: r.name_id, en: r.name_en }, stake: r.stake, payout: r.payout, net: r.net, createdAt: r.created_at }));
  const since = new Date(Date.parse(startOfLocalDayIso()) - 13 * 86_400_000).toISOString();
  const dur = all<any>(
    "SELECT substr(started_at,1,10) d, SUM(duration_sec) s, SUM(games_played) g FROM session_summaries WHERE user_id=? AND started_at>=? GROUP BY d ORDER BY d", userId, since
  ).map((r) => ({ day: r.d, minutes: Math.round(r.s / 60), rounds: r.g }));
  const ach = listAchievements(userId);
  const xp = one<{ xp: number }>("SELECT xp FROM users WHERE id=?", userId)!.xp;
  return {
    totals: {
      gamesPlayed: totals.games, coinsStaked: totals.staked, grossPayouts: totals.payouts, netBalanceChange: totals.net,
      coinsReceivedAsRewards: rewards,
    },
    byCategory, byGame, recent, sessionDurations: dur,
    achievements: { unlocked: ach.filter((a) => a.unlockedAt).length, total: ach.length },
    level: levelInfo(xp),
  };
}

export function leaderboard(limit = 20) {
  return all<any>(
    `SELECT u.id, u.xp, p.display_name, p.avatar_color, p.avatar_icon,
            (SELECT COUNT(*) FROM user_achievements a WHERE a.user_id=u.id) badges
     FROM users u JOIN user_profiles p ON p.user_id=u.id
     WHERE u.status='ACTIVE' AND p.show_on_leaderboard=1 AND u.xp>0
     ORDER BY u.xp DESC, u.created_at ASC LIMIT ?`, limit
  ).map((r, i) => ({
    rank: i + 1, displayName: r.display_name, avatarColor: r.avatar_color, avatarIcon: r.avatar_icon,
    xp: r.xp, level: levelInfo(r.xp).level, badges: r.badges,
  }));
}
