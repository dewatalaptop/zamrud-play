import { z } from "zod";
import type { GameEngine, ConfigCheck } from "./types";
import { weightedIndex } from "./rng";
import { badRequest } from "../lib/errors";

/**
 * Virtual Slots — 3 gulungan, simbol berbobot, gulungan independen.
 * Aturan bayar (kelipatan taruhan, total pengembalian termasuk taruhan):
 *  - 3 simbol sama  -> `three`
 *  - tepat 2 simbol sama -> `two` (milik simbol yang berpasangan)
 *  - semua berbeda -> 0 (setiap simbol punya `one`, default 0, dipakai bila > 0)
 * Pembayaran = floor(taruhan * kelipatan) — kelipatan bilangan bulat, jadi selalu eksak.
 */
const SymbolSchema = z.object({
  id: z.string().regex(/^[A-Z_]{3,12}$/),
  weight: z.number().int().min(1).max(1000),
  three: z.number().int().min(0).max(10000),
  two: z.number().int().min(0).max(1000),
  one: z.number().int().min(0).max(100).default(0),
});
export const SlotsConfigSchema = z.object({
  minStake: z.number().int().min(1),
  maxStake: z.number().int().min(1),
  stakeSteps: z.array(z.number().int().min(1)).min(1).max(12),
  symbols: z.array(SymbolSchema).min(3).max(12),
});
export type SlotsConfig = z.infer<typeof SlotsConfigSchema>;
export interface SlotsState { reels: string[]; }

export const slotsDefaultConfig: SlotsConfig = {
  minStake: 10,
  maxStake: 1000,
  stakeSteps: [10, 50, 100, 250, 500, 1000],
  symbols: [
    { id: "CHERRY", weight: 30, three: 5, two: 2, one: 0 },
    { id: "LEMON", weight: 25, three: 8, two: 0, one: 0 },
    { id: "BELL", weight: 18, three: 15, two: 1, one: 0 },
    { id: "CLOVER", weight: 12, three: 25, two: 1, one: 0 },
    { id: "STAR", weight: 8, three: 50, two: 1, one: 0 },
    { id: "DIAMOND", weight: 5, three: 100, two: 1, one: 0 },
    { id: "SEVEN", weight: 2, three: 250, two: 1, one: 0 },
  ],
};

export function slotsMultiplier(cfg: SlotsConfig, reels: string[]): number {
  const by = new Map(cfg.symbols.map((s) => [s.id, s]));
  const [a, b, c] = reels;
  if (a === b && b === c) return by.get(a)!.three;
  const pair = a === b ? a : a === c ? a : b === c ? b : null;
  if (pair) return by.get(pair)!.two;
  return Math.max(...reels.map((r) => by.get(r)!.one));
}

/** RTP eksak sebagai pecahan (pembilang/penyebut bilangan bulat) lewat enumerasi seluruh kombinasi. */
export function slotsRtp(cfg: SlotsConfig): { num: number; den: number; percent: number } {
  const total = cfg.symbols.reduce((s, x) => s + x.weight, 0);
  let num = 0;
  for (const x of cfg.symbols)
    for (const y of cfg.symbols)
      for (const z of cfg.symbols) {
        const w = x.weight * y.weight * z.weight;
        num += w * slotsMultiplier(cfg, [x.id, y.id, z.id]);
      }
  const den = total ** 3;
  return { num, den, percent: Math.round((num / den) * 10000) / 100 };
}

function validate(raw: unknown): ConfigCheck<SlotsConfig> {
  const p = SlotsConfigSchema.safeParse(raw);
  if (!p.success) return { ok: false, errors: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const c = p.data;
  const errors: string[] = [];
  if (c.minStake > c.maxStake) errors.push("minStake > maxStake");
  if (new Set(c.symbols.map((s) => s.id)).size !== c.symbols.length) errors.push("id simbol harus unik");
  if (c.stakeSteps.some((s) => s < c.minStake || s > c.maxStake)) errors.push("stakeSteps di luar min/max");
  if (!errors.length) {
    const { percent } = slotsRtp(c);
    if (percent > 100) errors.push(`RTP ${percent}% > 100%`);
    if (percent < 50) errors.push(`RTP ${percent}% < 50% (terlalu rendah)`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, config: c };
}

export const slotsEngine: GameEngine<SlotsConfig, SlotsState> = {
  slug: "virtual-slots",
  kind: "INSTANT",
  defaultConfig: slotsDefaultConfig,
  validateConfig: validate,
  describe(cfg) {
    const total = cfg.symbols.reduce((s, x) => s + x.weight, 0);
    return {
      minStake: cfg.minStake, maxStake: cfg.maxStake, stakeSteps: cfg.stakeSteps,
      symbols: cfg.symbols.map((s) => ({ ...s, chancePercent: Math.round((s.weight / total) * 10000) / 100 })),
      rtp: slotsRtp(cfg),
    };
  },
  parseStart(raw, cfg) {
    const i = z.object({ stake: z.number().int() }).strict().parse(raw);
    if (i.stake < cfg.minStake || i.stake > cfg.maxStake) throw badRequest("STAKE_OUT_OF_RANGE");
    return i;
  },
  start(cfg, input, rng) {
    const weights = cfg.symbols.map((s) => s.weight);
    const reels = [0, 1, 2].map(() => cfg.symbols[weightedIndex(weights, rng)].id);
    const mult = slotsMultiplier(cfg, reels);
    const payout = input.stake * mult;
    return {
      state: { reels },
      stake: input.stake,
      finished: true,
      payout,
      outcome: { reels, multiplier: mult, stake: input.stake },
    };
  },
  publicView: (s) => ({ reels: s.reels }),
};
