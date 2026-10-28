import { z } from "zod";
import type { GameEngine, ConfigCheck } from "./types";
import { weightedIndex } from "./rng";
import { badRequest } from "../lib/errors";

/**
 * Zamrud Slots 5×3 — 5 gulungan × 3 baris, 10 garis bayar tetap, simbol berbobot, setiap sel diundi independen.
 * Aturan (kelipatan dari taruhan PER GARIS = taruhan / jumlah garis):
 *  - Garis bayar dibaca dari kiri ke kanan mulai gulungan 1; 3, 4, atau 5 simbol sama berurutan membayar.
 *  - WILD menggantikan semua simbol biasa (bukan SCATTER). Garis dibayar sebagai simbol terbaik antara
 *    deretan WILD murni dan simbol yang digantikan.
 *  - SCATTER membayar di mana saja pada layar (3/4/5 buah) sebagai kelipatan TARUHAN TOTAL, tidak lewat garis.
 *  - Tidak ada putaran gratis, bonus, atau fitur lain: setiap putaran berdiri sendiri.
 * Taruhan wajib kelipatan jumlah garis, sehingga seluruh pembayaran bilangan bulat dan eksak.
 */
export const PAYLINES: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [2, 1, 1, 1, 2],
];
export const REELS = 5;
export const ROWS = 3;
export const WILD = "WILD";
export const SCATTER = "SCATTER";

const Pay3 = z.tuple([z.number().int().min(0).max(5000), z.number().int().min(0).max(5000), z.number().int().min(0).max(20000)]);
const SymbolSchema = z.object({
  id: z.string().regex(/^[A-Z_]{3,12}$/),
  weight: z.number().int().min(1).max(1000),
  /** Pembayaran garis untuk 3, 4, 5 simbol (× taruhan per garis). Tidak dipakai SCATTER. */
  pays: Pay3,
});
export const Slots5ConfigSchema = z.object({
  minStake: z.number().int().min(1),
  maxStake: z.number().int().min(1),
  stakeSteps: z.array(z.number().int().min(1)).min(1).max(12),
  symbols: z.array(SymbolSchema).min(5).max(12),
  /** Pembayaran SCATTER untuk 3, 4, 5+ buah (× taruhan TOTAL). */
  scatterPays: Pay3,
});
export type Slots5Config = z.infer<typeof Slots5ConfigSchema>;
export interface Slots5Win { line: number; symbol: string; count: number; mult: number; cells: number[] }
export interface Slots5State { grid: string[][]; wins: Slots5Win[]; scatter: { count: number; mult: number; cells: number[] } }

export const slots5DefaultConfig: Slots5Config = {
  minStake: 10,
  maxStake: 1000,
  stakeSteps: [10, 50, 100, 250, 500, 1000],
  symbols: [
    { id: "CHERRY", weight: 26, pays: [5, 15, 50] },
    { id: "LEMON", weight: 22, pays: [6, 18, 60] },
    { id: "BELL", weight: 16, pays: [10, 30, 100] },
    { id: "CLOVER", weight: 12, pays: [15, 50, 175] },
    { id: "STAR", weight: 8, pays: [25, 100, 375] },
    { id: "DIAMOND", weight: 5, pays: [50, 200, 750] },
    { id: "SEVEN", weight: 3, pays: [100, 375, 1500] },
    { id: WILD, weight: 4, pays: [100, 375, 1500] },
    { id: SCATTER, weight: 3, pays: [0, 0, 0] },
  ],
  scatterPays: [2, 10, 50],
};

const lineCount = PAYLINES.length;

/** Nilai satu garis (kelipatan taruhan per garis) dan sel yang ikut membayar. */
export function evalLine(cfg: Slots5Config, cells: string[]): { symbol: string; count: number; mult: number } {
  const by = new Map(cfg.symbols.map((s) => [s.id, s]));
  const payOf = (id: string, n: number) => (n >= 3 ? by.get(id)?.pays[Math.min(n, 5) - 3] ?? 0 : 0);
  // deretan WILD murni dari kiri
  let w = 0;
  while (w < REELS && cells[w] === WILD) w++;
  let best = { symbol: WILD, count: w, mult: payOf(WILD, w) };
  // simbol pertama yang bukan WILD menentukan deretan; SCATTER memutus garis
  const first = cells.find((c) => c !== WILD);
  if (first && first !== SCATTER) {
    let n = 0;
    while (n < REELS && (cells[n] === first || cells[n] === WILD)) n++;
    const m = payOf(first, n);
    if (m > best.mult) best = { symbol: first, count: n, mult: m };
  }
  return best.mult > 0 ? best : { symbol: best.symbol, count: 0, mult: 0 };
}

/** Evaluasi seluruh layar. `mult` dalam kelipatan taruhan TOTAL sebagai pecahan (lineSum/garis + scatter). */
export function evalGrid(cfg: Slots5Config, grid: string[][]): { wins: Slots5Win[]; scatter: Slots5State["scatter"]; lineSum: number; scatterMult: number } {
  const wins: Slots5Win[] = [];
  let lineSum = 0;
  PAYLINES.forEach((rows, li) => {
    const cells = rows.map((r, c) => grid[c][r]);
    const v = evalLine(cfg, cells);
    if (v.mult > 0) {
      wins.push({ line: li + 1, symbol: v.symbol, count: v.count, mult: v.mult, cells: rows.slice(0, v.count).map((r, c) => c * ROWS + r) });
      lineSum += v.mult;
    }
  });
  const scat: number[] = [];
  grid.forEach((col, c) => col.forEach((s, r) => { if (s === SCATTER) scat.push(c * ROWS + r); }));
  const scatterMult = scat.length >= 3 ? cfg.scatterPays[Math.min(scat.length, 5) - 3] : 0;
  return { wins, scatter: { count: scat.length, mult: scatterMult, cells: scatterMult ? scat : [] }, lineSum, scatterMult };
}

/** Pembayaran dalam koin: taruhan per garis × jumlah kelipatan garis + taruhan total × scatter. Selalu bilangan bulat. */
export function slots5Payout(cfg: Slots5Config, stake: number, grid: string[][]): number {
  const e = evalGrid(cfg, grid);
  return (stake / lineCount) * e.lineSum + stake * e.scatterMult;
}

/** RTP eksak lewat linearitas ekspektasi: tiap garis berisi 5 sel independen (59.049 kombinasi); scatter ~ Binomial(15, p). */
export function slots5Rtp(cfg: Slots5Config): { percent: number; lines: number; scatter: number; hit: number } {
  const total = cfg.symbols.reduce((s, x) => s + x.weight, 0);
  const ids = cfg.symbols.map((s) => s.id);
  let num = 0n; let hitNum = 0n;
  const W = cfg.symbols.map((s) => BigInt(s.weight));
  const idx = [0, 0, 0, 0, 0];
  const cells = ["", "", "", "", ""];
  const n = ids.length;
  const loop = (d: number, w: bigint) => {
    if (d === REELS) {
      const v = evalLine(cfg, cells);
      if (v.mult > 0) { num += w * BigInt(v.mult); hitNum += w; }
      return;
    }
    for (let i = 0; i < n; i++) { idx[d] = i; cells[d] = ids[i]; loop(d + 1, w * W[i]); }
  };
  loop(0, 1n);
  const den = BigInt(total) ** 5n;
  const lineE = Number(num * 1_000_000n / den) / 1_000_000; // E[kelipatan garis] per garis = bagian dari taruhan total
  // Scatter
  const ps = cfg.symbols.find((s) => s.id === SCATTER)?.weight ?? 0;
  const p = ps / total;
  const N = REELS * ROWS;
  const C = (nn: number, k: number) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (nn - k + i)) / i; return r; };
  let scatE = 0;
  for (let k = 3; k <= N; k++) scatE += C(N, k) * p ** k * (1 - p) ** (N - k) * cfg.scatterPays[Math.min(k, 5) - 3];
  const percent = Math.round((lineE + scatE) * 10000) / 100;
  return { percent, lines: Math.round(lineE * 10000) / 100, scatter: Math.round(scatE * 10000) / 100, hit: Math.round((Number(hitNum * 1_000_000n / den) / 1_000_000) * 10000) / 100 };
}

function validate(raw: unknown): ConfigCheck<Slots5Config> {
  const p = Slots5ConfigSchema.safeParse(raw);
  if (!p.success) return { ok: false, errors: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const c = p.data;
  const errors: string[] = [];
  if (c.minStake > c.maxStake) errors.push("minStake > maxStake");
  if (new Set(c.symbols.map((s) => s.id)).size !== c.symbols.length) errors.push("id simbol harus unik");
  if (!c.symbols.some((s) => s.id === WILD) || !c.symbols.some((s) => s.id === SCATTER)) errors.push("WILD dan SCATTER wajib ada");
  if (c.stakeSteps.some((s) => s < c.minStake || s > c.maxStake)) errors.push("stakeSteps di luar min/max");
  if (c.minStake % lineCount !== 0 || c.stakeSteps.some((s) => s % lineCount !== 0)) errors.push(`taruhan harus kelipatan ${lineCount} (jumlah garis)`);
  if (!errors.length) {
    const { percent } = slots5Rtp(c);
    if (percent > 100) errors.push(`RTP ${percent}% > 100%`);
    if (percent < 50) errors.push(`RTP ${percent}% < 50% (terlalu rendah)`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, config: c };
}

export const slots5Engine: GameEngine<Slots5Config, Slots5State> = {
  slug: "zamrud-slots-5",
  kind: "INSTANT",
  defaultConfig: slots5DefaultConfig,
  validateConfig: validate,
  describe(cfg) {
    const total = cfg.symbols.reduce((s, x) => s + x.weight, 0);
    return {
      minStake: cfg.minStake, maxStake: cfg.maxStake, stakeSteps: cfg.stakeSteps,
      reels: REELS, rows: ROWS, paylines: PAYLINES, scatterPays: cfg.scatterPays,
      symbols: cfg.symbols.map((s) => ({ ...s, chancePercent: Math.round((s.weight / total) * 10000) / 100 })),
      rtp: slots5Rtp(cfg),
    };
  },
  parseStart(raw, cfg) {
    const i = z.object({ stake: z.number().int() }).strict().parse(raw);
    if (i.stake < cfg.minStake || i.stake > cfg.maxStake || i.stake % lineCount !== 0) throw badRequest("STAKE_OUT_OF_RANGE");
    return i;
  },
  start(cfg, input, rng) {
    const weights = cfg.symbols.map((s) => s.weight);
    const grid = Array.from({ length: REELS }, () => Array.from({ length: ROWS }, () => cfg.symbols[weightedIndex(weights, rng)].id));
    const e = evalGrid(cfg, grid);
    const payout = (input.stake / lineCount) * e.lineSum + input.stake * e.scatterMult;
    const mult = input.stake ? payout / input.stake : 0;
    return {
      state: { grid, wins: e.wins, scatter: e.scatter },
      stake: input.stake,
      finished: true,
      payout,
      outcome: { grid, wins: e.wins, scatter: e.scatter, multiplier: mult, stake: input.stake },
    };
  },
  publicView: (s) => ({ grid: s.grid, wins: s.wins, scatter: s.scatter }),
};
