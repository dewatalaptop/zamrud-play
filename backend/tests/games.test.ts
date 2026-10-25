import { describe, expect, it } from "vitest";
import { sequenceRng, secureRng } from "../src/games/rng";
import { slotsDefaultConfig, slotsEngine, slotsMultiplier, slotsRtp } from "../src/games/slots";
import { Bet, betWins, colorOf, rouletteDefaultConfig, rouletteEngine, rouletteKindStats, roulettePayout } from "../src/games/roulette";
import { diceDefaultConfig, diceEngine, diceReturn, winningNumbers } from "../src/games/dice";
import { blackjackDefaultConfig, blackjackEngine, handValue, isBlackjack, type BlackjackState } from "../src/games/blackjack";
import { rank } from "../src/services/recommendations";

describe("slots", () => {
  const cfg = slotsDefaultConfig;
  it("RTP eksak dihitung dari seluruh kombinasi dan ≤ 100%", () => {
    const r = slotsRtp(cfg);
    expect(r.den).toBe(100 ** 3);
    expect(r.percent).toBeGreaterThan(90);
    expect(r.percent).toBeLessThanOrEqual(100);
    expect(r.percent).toBe(95.25);
  });
  it("aturan bayar: tiga sama, tepat dua sama, semua berbeda", () => {
    expect(slotsMultiplier(cfg, ["SEVEN", "SEVEN", "SEVEN"])).toBe(250);
    expect(slotsMultiplier(cfg, ["CHERRY", "BELL", "CHERRY"])).toBe(2);
    expect(slotsMultiplier(cfg, ["BELL", "BELL", "LEMON"])).toBe(1);
    expect(slotsMultiplier(cfg, ["LEMON", "LEMON", "CHERRY"])).toBe(0);
    expect(slotsMultiplier(cfg, ["CHERRY", "LEMON", "STAR"])).toBe(0);
  });
  it("hasil deterministik dengan RNG tersuntik; payout = taruhan × kelipatan", () => {
    // bobot kumulatif: CHERRY 0-29, LEMON 30-54, BELL 55-72 ...; angka 0 -> CHERRY
    const r = slotsEngine.start(cfg, { stake: 100 }, sequenceRng([0, 0, 0]));
    expect(r.outcome.reels).toEqual(["CHERRY", "CHERRY", "CHERRY"]);
    expect(r.payout).toBe(500);
    expect(r.stake).toBe(100);
  });
  it("menolak taruhan di luar batas dan field tak dikenal (mass assignment)", () => {
    expect(() => slotsEngine.parseStart({ stake: 5 }, cfg)).toThrow();
    expect(() => slotsEngine.parseStart({ stake: 100, payout: 999999 }, cfg)).toThrow();
  });
  it("validateConfig menolak RTP > 100%", () => {
    const bad = { ...cfg, symbols: cfg.symbols.map((s) => ({ ...s, three: s.three * 5 })) };
    expect(slotsEngine.validateConfig(bad).ok).toBe(false);
    expect(slotsEngine.validateConfig(cfg).ok).toBe(true);
  });
});

describe("roulette", () => {
  const cfg = rouletteDefaultConfig;
  it("warna dan kemenangan per jenis taruhan benar", () => {
    expect(colorOf(0)).toBe("green");
    expect(colorOf(1)).toBe("red");
    expect(colorOf(2)).toBe("black");
    const b = (kind: Bet["kind"], value?: number): Bet => ({ kind, value, stake: 10 });
    expect(betWins(b("red"), 0)).toBe(false);
    expect(betWins(b("even"), 0)).toBe(false);
    expect(betWins(b("low"), 18)).toBe(true);
    expect(betWins(b("high"), 18)).toBe(false);
    expect(betWins(b("dozen", 2), 13)).toBe(true);
    expect(betWins(b("dozen", 2), 25)).toBe(false);
    expect(betWins(b("straight", 0), 0)).toBe(true);
  });
  it("pembayaran bilangan bulat: straight 36x, warna 2x, dozen 3x", () => {
    expect(roulettePayout(cfg, [{ kind: "straight", value: 17, stake: 10 }], 17)).toBe(360);
    expect(roulettePayout(cfg, [{ kind: "red", stake: 100 }, { kind: "black", stake: 100 }], 1)).toBe(200);
    expect(roulettePayout(cfg, [{ kind: "dozen", value: 1, stake: 30 }], 5)).toBe(90);
    expect(roulettePayout(cfg, [{ kind: "red", stake: 50 }], 0)).toBe(0);
  });
  it("RTP setiap jenis taruhan = 97.3% (36/37)", () => {
    for (const k of rouletteKindStats(cfg)) expect(k.rtpPercent).toBe(97.3);
  });
  it("start memotong total taruhan semua bet", () => {
    const input = rouletteEngine.parseStart({ bets: [{ kind: "red", stake: 10 }, { kind: "straight", value: 7, stake: 20 }] }, cfg);
    const r = rouletteEngine.start(cfg, input, sequenceRng([7]));
    expect(r.stake).toBe(30);
    expect(r.payout).toBe(20 * 36 + 10 * 2); // 7 = merah
  });
  it("menolak taruhan tidak valid", () => {
    expect(() => rouletteEngine.parseStart({ bets: [{ kind: "straight", stake: 10 }] }, cfg)).toThrow();
    expect(() => rouletteEngine.parseStart({ bets: [{ kind: "straight", value: 40, stake: 10 }] }, cfg)).toThrow();
    expect(() => rouletteEngine.parseStart({ bets: [{ kind: "red", value: 1, stake: 10 }] }, cfg)).toThrow();
    expect(() => rouletteEngine.parseStart({ bets: [] }, cfg)).toThrow();
  });
  it("validateConfig menolak payout > RTP 100%", () => {
    expect(rouletteEngine.validateConfig({ ...cfg, payouts: { ...cfg.payouts, straight: 40 } }).ok).toBe(false);
  });
});

describe("dice", () => {
  const cfg = diceDefaultConfig;
  it("jumlah angka menang dan pengembalian dibulatkan ke bawah", () => {
    expect(winningNumbers(cfg, "under", 51)).toBe(50);
    expect(winningNumbers(cfg, "over", 50)).toBe(50);
    expect(diceReturn(cfg, 100, 50)).toBe(198);
    expect(diceReturn(cfg, 10, 95)).toBe(10); // floor(10.42)
    expect(diceReturn(cfg, 100, 5)).toBe(1980);
  });
  it("menang/kalah mengikuti hasil lemparan", () => {
    const input = diceEngine.parseStart({ stake: 100, mode: "under", target: 51 }, cfg);
    const win = diceEngine.start(cfg, input, sequenceRng([9])); // roll = 10
    expect(win.outcome.roll).toBe(10);
    expect(win.payout).toBe(198);
    const lose = diceEngine.start(cfg, input, sequenceRng([89])); // roll = 90
    expect(lose.payout).toBe(0);
    const edge = diceEngine.start(cfg, input, sequenceRng([50])); // roll = 51 -> bukan < 51
    expect(edge.payout).toBe(0);
  });
  it("menolak target di luar rentang peluang", () => {
    expect(() => diceEngine.parseStart({ stake: 100, mode: "under", target: 2 }, cfg)).toThrow(); // k = 1
    expect(() => diceEngine.parseStart({ stake: 100, mode: "over", target: 99 }, cfg)).toThrow();
  });
  it("RTP tertinggi = 99% dan config RTP>100% ditolak", () => {
    expect((diceEngine.describe(cfg) as any).maxRtpPercent).toBe(99);
    expect(diceEngine.validateConfig({ ...cfg, payoutNumerator: 101 }).ok).toBe(false);
  });
});

describe("blackjack", () => {
  const cfg = blackjackDefaultConfig;
  // id kartu: rank = id % 13 (0=As,1=2,...,9=10,10=J,11=Q,12=K)
  const A = 0, K = 12, N10 = 9, N5 = 4, N6 = 5, N7 = 6, N9 = 8, N2 = 1;
  const mk = (over: Partial<BlackjackState>): BlackjackState => ({
    shoe: [], pos: 0, player: [], dealer: [], wagered: 100, doubled: false, phase: "PLAYER", ...over,
  });

  it("nilai tangan: As lunak/keras, blackjack hanya 2 kartu", () => {
    expect(handValue([A, K]).total).toBe(21);
    expect(handValue([A, A]).total).toBe(12);
    expect(handValue([A, A, 8]).total).toBe(21);
    expect(handValue([A, N6]).soft).toBe(true);
    expect(handValue([K, N6, N7]).total).toBe(23);
    expect(isBlackjack([A, K])).toBe(true);
    expect(isBlackjack([N7, N7, N7])).toBe(false);
  });
  it("hit ke 21 -> otomatis stand, dealer 17 -> pemain menang 1:1", () => {
    // shuffle dengan RNG nol-semua -> bangun shoe deterministik lalu cari kartu; di sini uji lewat act pada state buatan
    const s = mk({ player: [N10, N5], dealer: [N10, N7], shoe: [N6] });
    const r = blackjackEngine.act!(cfg, s, { type: "hit" }, secureRng); // 21 -> otomatis stand; dealer 17 stand -> menang
    expect(r.finished).toBe(true);
    expect((r.outcome as any).result).toBe("WIN");
    expect(r.payout).toBe(200);
  });
  it("hit bust -> kalah, payout 0", () => {
    const s = mk({ player: [N10, N6], dealer: [N10, N7], shoe: [N10] });
    const r = blackjackEngine.act!(cfg, s, { type: "hit" }, secureRng);
    expect(r.finished).toBe(true);
    expect((r.outcome as any).result).toBe("BUST");
    expect(r.payout).toBe(0);
  });
  it("stand: dealer berhenti di semua 17, seri mengembalikan taruhan", () => {
    const s = mk({ player: [N10, N7], dealer: [N10, N7], shoe: [] });
    const r = blackjackEngine.act!(cfg, s, { type: "stand" }, secureRng);
    expect((r.outcome as any).result).toBe("PUSH");
    expect(r.payout).toBe(100);
    const soft17 = mk({ player: [N10, N9], dealer: [A, N6], shoe: [] }); // soft 17: dealer berhenti
    const r2 = blackjackEngine.act!(cfg, soft17, { type: "stand" }, secureRng);
    expect((r2.outcome as any).result).toBe("WIN");
    expect(r2.payout).toBe(200);
  });
  it("dealer draw sampai ≥17 lalu bust -> pemain menang", () => {
    const s = mk({ player: [N10, N5], dealer: [N10, N6], shoe: [N10] });
    const r = blackjackEngine.act!(cfg, s, { type: "stand" }, secureRng);
    expect((r.outcome as any).result).toBe("DEALER_BUST");
    expect(r.payout).toBe(200);
  });
  it("double down: taruhan tambahan = taruhan awal, tepat satu kartu, payout 2× total", () => {
    const s = mk({ player: [N5, N6], dealer: [N10, N7], shoe: [N10] }); // 11 + 10 = 21
    const r = blackjackEngine.act!(cfg, s, { type: "double" }, secureRng);
    expect(r.extraStake).toBe(100);
    expect((r.state as BlackjackState).wagered).toBe(200);
    expect(r.finished).toBe(true);
    expect(r.payout).toBe(400);
  });
  it("double tidak boleh setelah hit atau dua kali", () => {
    const afterHit = mk({ player: [N2, N2, N2], dealer: [N10, N7], shoe: [N2] });
    expect(() => blackjackEngine.act!(cfg, afterHit, { type: "double" }, secureRng)).toThrow();
    const doubled = mk({ player: [N5, N6], dealer: [N10, N7], shoe: [N2], doubled: true });
    expect(() => blackjackEngine.act!(cfg, doubled, { type: "double" }, secureRng)).toThrow();
  });
  it("aksi pada ronde selesai ditolak", () => {
    const s = mk({ player: [N10, N7], dealer: [N10, N7], phase: "DONE" });
    expect(() => blackjackEngine.act!(cfg, s, { type: "hit" }, secureRng)).toThrow();
  });
  it("publicView menyembunyikan kartu dealer & shoe saat ronde berjalan", () => {
    const s = mk({ player: [N10, N7], dealer: [N10, N6], shoe: [1, 2, 3] });
    const v = blackjackEngine.publicView(s, false) as any;
    expect(v.dealer).toEqual([N10]);
    expect(v.dealerHiddenCards).toBe(1);
    expect(v.dealerTotal).toBeNull();
    expect(JSON.stringify(v)).not.toContain("shoe");
  });
  it("aksi tak dikenal ditolak (tidak bisa mengirim kartu sendiri)", () => {
    expect(() => blackjackEngine.parseAction!({ type: "hit", card: 12 })).toThrow();
    expect(() => blackjackEngine.parseAction!({ type: "cheat" })).toThrow();
  });
  it("start() dengan RNG nyata selalu konsisten: 4 kartu terbagi, shoe 312 kartu", () => {
    for (let i = 0; i < 50; i++) {
      const r = blackjackEngine.start(cfg, { stake: 100 }, secureRng);
      const s = r.state as BlackjackState;
      expect(s.shoe).toHaveLength(312);
      expect(s.pos).toBe(4);
      expect(new Set(s.shoe.slice(0, 4)).size).toBeGreaterThan(0);
      if (r.finished) expect([0, 100, 250]).toContain(r.payout);
    }
  });
});

describe("rekomendasi", () => {
  const games = [
    { slug: "a", category: "SLOTS", tags: ["luck", "quick"], difficulty: "easy", sortOrder: 1 },
    { slug: "b", category: "CARDS", tags: ["strategy"], difficulty: "hard", sortOrder: 2 },
    { slug: "c", category: "DICE", tags: ["luck", "numbers"], difficulty: "easy", sortOrder: 3 },
  ];
  const base = { games, prefs: { favoriteCategories: [], preferredTags: [], difficulty: "any" }, favorites: [], recent: [], playCount: {}, personalization: true };
  it("menyertakan alasan transparan dari preferensi eksplisit", () => {
    const r = rank({ ...base, prefs: { ...base.prefs, preferredTags: ["strategy"] } });
    expect(r[0].slug).toBe("b");
    expect(r[0].reason).toEqual({ key: "rec.preferredTag", params: { tag: "strategy" } });
  });
  it("personalisasi nonaktif -> urutan katalog netral", () => {
    const r = rank({ ...base, personalization: false, prefs: { ...base.prefs, preferredTags: ["strategy"] } });
    expect(r.map((x) => x.slug)).toEqual(["a", "b", "c"]);
    expect(r.every((x) => x.reason.key === "rec.default" && x.score === 0)).toBe(true);
  });
  it("keragaman: game yang baru dimainkan diturunkan; eksplorasi game belum dicoba", () => {
    const r = rank({ ...base, favorites: ["a"], recent: ["a"], playCount: { a: 5 } });
    expect(r.find((x) => x.slug === "a")!.score).toBeLessThan(5);
    expect(r.some((x) => x.reason.key === "rec.explore")).toBe(true);
  });
});
