import { z } from "zod";
import type { GameEngine, ConfigCheck } from "./types";
import { badRequest } from "../lib/errors";

/**
 * Dice — lempar angka 1..sides (default 100). Pemain memilih `under` (menang bila hasil < target)
 * atau `over` (menang bila hasil > target). Jumlah angka menang = k.
 * Pengembalian = floor(taruhan × payoutNumerator / k) — pembulatan ke bawah (selalu merugikan
 * pemain, tidak pernah menguntungkan). RTP maksimum = payoutNumerator/sides.
 */
export const DiceConfigSchema = z.object({
  minStake: z.number().int().min(1),
  maxStake: z.number().int().min(1),
  stakeSteps: z.array(z.number().int().min(1)).min(1).max(12),
  sides: z.number().int().min(10).max(1000),
  payoutNumerator: z.number().int().min(1),
  minWinningNumbers: z.number().int().min(1),
  maxWinningNumbers: z.number().int().min(1),
});
export type DiceConfig = z.infer<typeof DiceConfigSchema>;
export interface DiceState { roll: number; mode: "under" | "over"; target: number; winningNumbers: number; }

export const diceDefaultConfig: DiceConfig = {
  minStake: 10, maxStake: 1000, stakeSteps: [10, 50, 100, 250, 500, 1000],
  sides: 100, payoutNumerator: 99, minWinningNumbers: 5, maxWinningNumbers: 95,
};

export const winningNumbers = (cfg: DiceConfig, mode: "under" | "over", target: number) =>
  mode === "under" ? target - 1 : cfg.sides - target;
export const diceReturn = (cfg: DiceConfig, stake: number, k: number) => Math.floor((stake * cfg.payoutNumerator) / k);

function validate(raw: unknown): ConfigCheck<DiceConfig> {
  const p = DiceConfigSchema.safeParse(raw);
  if (!p.success) return { ok: false, errors: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const c = p.data;
  const errors: string[] = [];
  if (c.minStake > c.maxStake) errors.push("minStake > maxStake");
  if (c.stakeSteps.some((s) => s < c.minStake || s > c.maxStake)) errors.push("stakeSteps di luar min/max");
  if (c.payoutNumerator > c.sides) errors.push("RTP > 100% (payoutNumerator > sides)");
  if (c.minWinningNumbers > c.maxWinningNumbers || c.maxWinningNumbers >= c.sides) errors.push("rentang angka menang tidak valid");
  return errors.length ? { ok: false, errors } : { ok: true, config: c };
}

export const diceEngine: GameEngine<DiceConfig, DiceState> = {
  slug: "dice-duel",
  kind: "INSTANT",
  defaultConfig: diceDefaultConfig,
  validateConfig: validate,
  describe: (cfg) => ({
    minStake: cfg.minStake, maxStake: cfg.maxStake, stakeSteps: cfg.stakeSteps, sides: cfg.sides,
    payoutNumerator: cfg.payoutNumerator, minWinningNumbers: cfg.minWinningNumbers, maxWinningNumbers: cfg.maxWinningNumbers,
    maxRtpPercent: Math.round((cfg.payoutNumerator / cfg.sides) * 10000) / 100,
  }),
  parseStart(raw, cfg) {
    const i = z.object({ stake: z.number().int(), mode: z.enum(["under", "over"]), target: z.number().int() }).strict().parse(raw);
    if (i.stake < cfg.minStake || i.stake > cfg.maxStake) throw badRequest("STAKE_OUT_OF_RANGE");
    const k = winningNumbers(cfg, i.mode, i.target);
    if (k < cfg.minWinningNumbers || k > cfg.maxWinningNumbers) throw badRequest("INVALID_TARGET");
    return i;
  },
  start(cfg, input, rng) {
    const roll = rng.int(cfg.sides) + 1;
    const k = winningNumbers(cfg, input.mode, input.target);
    const win = input.mode === "under" ? roll < input.target : roll > input.target;
    const payout = win ? diceReturn(cfg, input.stake, k) : 0;
    return {
      state: { roll, mode: input.mode, target: input.target, winningNumbers: k },
      stake: input.stake, finished: true, payout,
      outcome: { roll, mode: input.mode, target: input.target, winningNumbers: k, win, stake: input.stake },
    };
  },
  publicView: (s) => s,
};
