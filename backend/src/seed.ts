import { one, run, tx } from "./db";
import { catalog, engines } from "./games/registry";
import { iso } from "./lib/clock";
import { newId } from "./lib/security";
import { ECONOMY_DEFAULTS } from "./services/settings";

/** Idempoten: aman dijalankan tiap start. Tidak menimpa perubahan admin, dan TIDAK membuat akun admin. */
export function seedAll() {
  tx(() => {
    const at = iso();
    for (const g of catalog) {
      if (one("SELECT 1 x FROM games WHERE slug=?", g.slug)) continue;
      const id = newId();
      run(
        `INSERT INTO games(id,slug,category,tags,difficulty,kind,name_id,name_en,desc_id,desc_en,enabled,sort_order,active_config_version,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,1,?,1,?,?)`,
        id, g.slug, g.category, JSON.stringify(g.tags), g.difficulty, g.kind, g.nameId, g.nameEn, g.descId, g.descEn, g.sortOrder, at, at
      );
      run(
        "INSERT INTO game_configs(id,game_id,version,config,status,created_at,published_at) VALUES(?,?,1,?,'PUBLISHED',?,?)",
        newId(), id, JSON.stringify(engines[g.slug].defaultConfig), at, at
      );
    }

    const missions: [string, string, string, number, number, string, string, string, string, number][] = [
      ["tutorial", "ONCE", "COMPLETE_TUTORIAL", 1, 1000, "Selesaikan tur singkat", "Complete the quick tour", "Ikuti tur singkat di dasbor untuk mengenal fitur utama.", "Take the short tour on the dashboard to learn the main features.", 1],
      ["customize-preferences", "ONCE", "UPDATE_PREFERENCES", 1, 500, "Atur preferensi bermain", "Set your play preferences", "Pilih kategori favorit dan atur kenyamanan animasi.", "Pick favourite categories and set animation comfort.", 2],
      ["customize-profile", "ONCE", "UPDATE_PROFILE", 1, 300, "Personalisasi profil", "Personalise your profile", "Ubah warna atau ikon avatar dan bio Anda.", "Change your avatar colour or icon and bio.", 3],
      ["review-rules", "DAILY", "REVIEW_RULES", 1, 200, "Baca aturan sebuah game", "Read a game's rules", "Buka halaman aturan salah satu game hari ini.", "Open the rules of any game today.", 4],
      ["complete-round", "DAILY", "COMPLETE_SESSION", 1, 300, "Selesaikan satu ronde", "Complete one round", "Selesaikan satu ronde game apa pun hari ini.", "Finish one round of any game today.", 5],
      ["explore-category", "WEEKLY", "DISTINCT_CATEGORIES", 2, 500, "Jelajahi kategori baru", "Explore a new category", "Mainkan game dari dua kategori berbeda minggu ini.", "Play games from two different categories this week.", 6],
      ["three-games", "WEEKLY", "DISTINCT_GAMES", 3, 2500, "Tantangan mingguan: tiga game berbeda", "Weekly challenge: three different games", "Mainkan tiga jenis game berbeda dalam satu minggu — santai saja, tanpa tekanan waktu.", "Play three different game types in a week — at your own pace.", 7],
    ];
    for (const m of missions) {
      if (one("SELECT 1 x FROM missions WHERE key=?", m[0])) continue;
      run(
        `INSERT INTO missions(id,key,period,metric,target,reward_coins,title_id,title_en,desc_id,desc_en,active,sort_order,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?,?)`,
        newId(), m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], at, at
      );
    }

    const ach: [string, string, number, string, string, string, string, string, number][] = [
      ["first-game", "GAMES_PLAYED", 1, "play", "Game Pertama", "First Game", "Selesaikan ronde pertama Anda.", "Finish your first round.", 1],
      ["explorer", "DISTINCT_CATEGORIES", 3, "compass", "Penjelajah", "Explorer", "Mainkan game dari tiga kategori berbeda.", "Play games from three different categories.", 2],
      ["strategy-learner", "STRATEGY_ROUNDS", 3, "brain", "Pelajar Strategi", "Strategy Learner", "Selesaikan tiga ronde game strategi.", "Finish three rounds of a strategy game.", 3],
      ["game-collector", "DISTINCT_GAMES", 4, "layers", "Kolektor Game", "Game Collector", "Coba keempat game yang tersedia.", "Try all four available games.", 4],
      ["stats-enthusiast", "STATS_VIEWED", 3, "chart", "Penggemar Statistik", "Statistics Enthusiast", "Lihat halaman statistik tiga kali.", "View the statistics page three times.", 5],
      ["rule-reader", "RULES_REVIEWED", 4, "book", "Pembaca Aturan", "Rule Reader", "Baca aturan keempat game.", "Read the rules of all four games.", 6],
      ["curator", "FAVORITES", 2, "heart", "Kurator", "Curator", "Tandai dua game favorit.", "Mark two favourite games.", 7],
    ];
    for (const a of ach) {
      if (one("SELECT 1 x FROM achievements WHERE key=?", a[0])) continue;
      run(
        "INSERT INTO achievements(id,key,metric,threshold,icon,name_id,name_en,desc_id,desc_en,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?)",
        newId(), a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8]
      );
    }

    if (!one("SELECT 1 x FROM promo_codes WHERE code=?", "SELAMATDATANG")) {
      run("INSERT INTO promo_codes(id,code,reward_coins,max_redemptions,created_at) VALUES(?,?,?,?,?)", newId(), "SELAMATDATANG", 1000, 10000, at);
    }
    if (!one("SELECT 1 x FROM settings WHERE key='economy'")) {
      run("INSERT INTO settings(key,value,updated_at) VALUES('economy',?,?)", JSON.stringify(ECONOMY_DEFAULTS), at);
    }
  });
}
