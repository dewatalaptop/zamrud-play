import { z } from "zod";
import { one, run } from "../db";
import { iso } from "../lib/clock";

// Ekonomi virtual yang dapat dikonfigurasi admin (semua gratis; tidak ada pembelian koin).
export const EconomySchema = z.object({
  startingBalance: z.number().int().min(0).max(1_000_000),
  dailyReward: z.number().int().min(0).max(100_000),
  dailyRewardMaxPerDay: z.number().int().min(1).max(5),
  xpPerRound: z.number().int().min(0).max(50),
  xpPerRoundDailyCap: z.number().int().min(0).max(1000),
  xpPerMission: z.number().int().min(0).max(1000),
  xpPerAchievement: z.number().int().min(0).max(1000),
}).strict();
export type Economy = z.infer<typeof EconomySchema>;

export const ECONOMY_DEFAULTS: Economy = {
  startingBalance: 10_000,
  dailyReward: 500,
  dailyRewardMaxPerDay: 1,
  xpPerRound: 5,
  xpPerRoundDailyCap: 50,
  xpPerMission: 50,
  xpPerAchievement: 100,
};

export function getEconomy(): Economy {
  const row = one<{ value: string }>("SELECT value FROM settings WHERE key='economy'");
  if (!row) return ECONOMY_DEFAULTS;
  const parsed = EconomySchema.safeParse({ ...ECONOMY_DEFAULTS, ...JSON.parse(row.value) });
  return parsed.success ? parsed.data : ECONOMY_DEFAULTS;
}

export function setEconomy(next: Economy) {
  run(
    "INSERT INTO settings(key,value,updated_at) VALUES('economy',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
    JSON.stringify(next),
    iso()
  );
}
