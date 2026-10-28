import type { GameEngine } from "./types";
import { slotsEngine } from "./slots";
import { slots5Engine } from "./slots5";
import { rouletteEngine } from "./roulette";
import { blackjackEngine } from "./blackjack";
import { diceEngine } from "./dice";

export const engines: Record<string, GameEngine> = {
  [slotsEngine.slug]: slotsEngine,
  [slots5Engine.slug]: slots5Engine,
  [rouletteEngine.slug]: rouletteEngine,
  [blackjackEngine.slug]: blackjackEngine,
  [diceEngine.slug]: diceEngine,
};

export const getEngine = (slug: string): GameEngine | undefined => engines[slug];

/** Metadata katalog default (di-seed ke tabel games; admin boleh mengubah teks/enabled). */
export const catalog = [
  {
    slug: slotsEngine.slug, category: "SLOTS", kind: "INSTANT", tags: ["luck", "quick", "visual"], difficulty: "easy", sortOrder: 1,
    nameId: "Slot Virtual", nameEn: "Virtual Slots",
    descId: "Putar tiga gulungan bersimbol. Hasil ditentukan server dengan bobot simbol yang transparan.",
    descEn: "Spin three symbol reels. The server decides every result with a transparent symbol weighting.",
  },
  {
    slug: slots5Engine.slug, category: "SLOTS", kind: "INSTANT", tags: ["luck", "visual"], difficulty: "medium", sortOrder: 5,
    nameId: "Zamrud Slots 5×3", nameEn: "Zamrud Slots 5×3",
    descId: "Lima gulungan, 10 garis bayar, simbol WILD dan SCATTER. Tanpa putaran gratis atau bonus; tiap putaran berdiri sendiri.",
    descEn: "Five reels, 10 paylines, WILD and SCATTER symbols. No free spins or bonuses; every spin stands alone.",
  },
  {
    slug: rouletteEngine.slug, category: "WHEEL", kind: "INSTANT", tags: ["luck", "classic", "visual"], difficulty: "medium", sortOrder: 2,
    nameId: "Roulette Eropa", nameEn: "European Roulette",
    descId: "Roda 37 kantong dengan pilihan warna, angka, ganjil/genap, dan lusinan.",
    descEn: "A 37-pocket wheel with colour, number, odd/even and dozen bets.",
  },
  {
    slug: blackjackEngine.slug, category: "CARDS", kind: "INTERACTIVE", tags: ["strategy", "classic", "cards"], difficulty: "hard", sortOrder: 3,
    nameId: "Blackjack 21", nameEn: "Blackjack 21",
    descId: "Capai 21 tanpa lewat. Ambil kartu, berhenti, atau gandakan. Server menjaga semua kartu.",
    descEn: "Reach 21 without going over. Hit, stand or double down. The server holds every card.",
  },
  {
    slug: diceEngine.slug, category: "DICE", kind: "INSTANT", tags: ["luck", "quick", "numbers"], difficulty: "easy", sortOrder: 4,
    nameId: "Dadu Duel", nameEn: "Dice Duel",
    descId: "Tebak hasil lemparan di bawah atau di atas angka target. Peluang dan pengembalian ditampilkan jelas.",
    descEn: "Guess whether the roll lands under or over your target. Chance and return are shown clearly.",
  },
] as const;
