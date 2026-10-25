import { z } from "zod";
import type { GameEngine, ConfigCheck } from "./types";
import { badRequest } from "../lib/errors";

/**
 * Roulette Eropa (37 kantong: 0-36, satu nol hijau). Setiap taruhan dihitung sendiri;
 * `payouts` = kelipatan total pengembalian (termasuk taruhan), bilangan bulat:
 *  straight (satu angka) 36x · green (0) 36x · dozen (1-12/13-24/25-36) 3x ·
 *  red/black/odd/even/low(1-18)/high(19-36) 2x. Kantong 0 mengalahkan semua taruhan kecuali straight-0/green.
 */
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = (n: number): "red" | "black" | "green" => (n === 0 ? "green" : RED.has(n) ? "red" : "black");

export const BET_KINDS = ["straight", "red", "black", "green", "odd", "even", "low", "high", "dozen"] as const;
export type BetKind = (typeof BET_KINDS)[number];

export const RouletteConfigSchema = z.object({
  minStake: z.number().int().min(1),
  maxStake: z.number().int().min(1), // per taruhan
  stakeSteps: z.array(z.number().int().min(1)).min(1).max(12),
  maxBets: z.number().int().min(1).max(12),
  payouts: z.object({
    straight: z.number().int().min(2).max(100),
    green: z.number().int().min(2).max(100),
    dozen: z.number().int().min(2).max(10),
    evenMoney: z.number().int().min(2).max(5),
  }),
});
export type RouletteConfig = z.infer<typeof RouletteConfigSchema>;
export interface RouletteState { number: number; bets: Bet[]; }
export interface Bet { kind: BetKind; value?: number; stake: number; }

export const rouletteDefaultConfig: RouletteConfig = {
  minStake: 10,
  maxStake: 1000,
  stakeSteps: [10, 50, 100, 250, 500, 1000],
  maxBets: 6,
  payouts: { straight: 36, green: 36, dozen: 3, evenMoney: 2 },
};

export function betWins(b: Bet, n: number): boolean {
  switch (b.kind) {
    case "straight": return n === b.value;
    case "green": return n === 0;
    case "red": return colorOf(n) === "red";
    case "black": return colorOf(n) === "black";
    case "odd": return n !== 0 && n % 2 === 1;
    case "even": return n !== 0 && n % 2 === 0;
    case "low": return n >= 1 && n <= 18;
    case "high": return n >= 19 && n <= 36;
    case "dozen": return n >= 1 && Math.ceil(n / 12) === b.value;
  }
}

export function betMultiplier(cfg: RouletteConfig, kind: BetKind): number {
  if (kind === "straight") return cfg.payouts.straight;
  if (kind === "green") return cfg.payouts.green;
  if (kind === "dozen") return cfg.payouts.dozen;
  return cfg.payouts.evenMoney;
}

export function roulettePayout(cfg: RouletteConfig, bets: Bet[], n: number): number {
  return bets.reduce((sum, b) => (betWins(b, n) ? sum + b.stake * betMultiplier(cfg, b.kind) : sum), 0);
}

/** Jumlah kantong menang per jenis taruhan dan RTP eksak (menang/37 × kelipatan). */
export function rouletteKindStats(cfg: RouletteConfig) {
  return BET_KINDS.map((kind) => {
    const sample: Bet = { kind, value: kind === "straight" ? 7 : kind === "dozen" ? 1 : undefined, stake: 1 };
    let wins = 0;
    for (let n = 0; n <= 36; n++) if (betWins(sample, n)) wins++;
    const mult = betMultiplier(cfg, kind);
    return { kind, winningPockets: wins, multiplier: mult, rtpPercent: Math.round(((wins * mult) / 37) * 10000) / 100 };
  });
}

const BetSchema = z.object({
  kind: z.enum(BET_KINDS),
  value: z.number().int().optional(),
  stake: z.number().int(),
}).strict();

function validate(raw: unknown): ConfigCheck<RouletteConfig> {
  const p = RouletteConfigSchema.safeParse(raw);
  if (!p.success) return { ok: false, errors: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const c = p.data;
  const errors: string[] = [];
  if (c.minStake > c.maxStake) errors.push("minStake > maxStake");
  if (c.stakeSteps.some((s) => s < c.minStake || s > c.maxStake)) errors.push("stakeSteps di luar min/max");
  for (const k of rouletteKindStats(c)) if (k.rtpPercent > 100) errors.push(`RTP ${k.kind} ${k.rtpPercent}% > 100%`);
  return errors.length ? { ok: false, errors } : { ok: true, config: c };
}

export const rouletteEngine: GameEngine<RouletteConfig, RouletteState> = {
  slug: "euro-roulette",
  kind: "INSTANT",
  defaultConfig: rouletteDefaultConfig,
  validateConfig: validate,
  describe: (cfg) => ({
    minStake: cfg.minStake, maxStake: cfg.maxStake, stakeSteps: cfg.stakeSteps, maxBets: cfg.maxBets,
    pockets: 37, kinds: rouletteKindStats(cfg),
  }),
  parseStart(raw, cfg) {
    const i = z.object({ bets: z.array(BetSchema).min(1) }).strict().parse(raw);
    if (i.bets.length > cfg.maxBets) throw badRequest("TOO_MANY_BETS");
    for (const b of i.bets) {
      if (b.stake < cfg.minStake || b.stake > cfg.maxStake) throw badRequest("STAKE_OUT_OF_RANGE");
      if (b.kind === "straight") {
        if (b.value === undefined || b.value < 0 || b.value > 36) throw badRequest("INVALID_BET");
      } else if (b.kind === "dozen") {
        if (b.value === undefined || b.value < 1 || b.value > 3) throw badRequest("INVALID_BET");
      } else if (b.value !== undefined) throw badRequest("INVALID_BET");
    }
    return i as { bets: Bet[] };
  },
  start(cfg, input, rng) {
    const n = rng.int(37);
    const bets: Bet[] = input.bets;
    const stake = bets.reduce((s, b) => s + b.stake, 0);
    const payout = roulettePayout(cfg, bets, n);
    return {
      state: { number: n, bets },
      stake,
      finished: true,
      payout,
      outcome: { number: n, color: colorOf(n), bets, stake },
    };
  },
  publicView: (s) => ({ number: s.number, color: colorOf(s.number), bets: s.bets }),
};
