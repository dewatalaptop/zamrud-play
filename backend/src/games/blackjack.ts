import { z } from "zod";
import type { GameEngine, ConfigCheck, Rng } from "./types";
import { shuffle } from "./rng";
import { badRequest } from "../lib/errors";

/**
 * Blackjack — shoe 6 dek dikocok baru tiap ronde, state & shoe hanya ada di server.
 * Aturan: dealer berhenti di semua 17 (S17, termasuk soft 17) · blackjack alami membayar 3:2
 * (bagian 3:2 dibulatkan ke bawah) · menang 1:1 · seri mengembalikan taruhan · double down
 * hanya pada 2 kartu pertama (taruhan tambahan = taruhan awal, tepat 1 kartu lagi lalu otomatis stand) ·
 * tanpa split, insurance, surrender. Dealer mengintip blackjack di awal ronde.
 * Kartu: id 0..51 → rank = id % 13 (0 = As), suit = floor(id/13) % 4.
 */
export const BlackjackConfigSchema = z.object({
  minStake: z.number().int().min(1),
  maxStake: z.number().int().min(1),
  stakeSteps: z.array(z.number().int().min(1)).min(1).max(12),
  decks: z.number().int().min(1).max(8),
  blackjackNum: z.number().int().min(1),
  blackjackDen: z.number().int().min(1),
});
export type BlackjackConfig = z.infer<typeof BlackjackConfigSchema>;

export type Phase = "PLAYER" | "DONE";
export type Result = "BLACKJACK" | "WIN" | "DEALER_BUST" | "LOSE" | "BUST" | "PUSH" | "DEALER_BLACKJACK";
export interface BlackjackState {
  shoe: number[];
  pos: number;
  player: number[];
  dealer: number[];
  wagered: number; // total taruhan pada ronde ini (naik saat double)
  doubled: boolean;
  phase: Phase;
  result?: Result;
}

export const blackjackDefaultConfig: BlackjackConfig = {
  minStake: 10, maxStake: 1000, stakeSteps: [10, 50, 100, 250, 500, 1000],
  decks: 6, blackjackNum: 3, blackjackDen: 2,
};

const rankValue = (card: number) => {
  const r = card % 13;
  return r === 0 ? 11 : r >= 9 ? 10 : r + 1;
};
export function handValue(cards: number[]): { total: number; soft: boolean } {
  let total = 0, aces = 0;
  for (const c of cards) {
    total += rankValue(c);
    if (c % 13 === 0) aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}
export const isBlackjack = (cards: number[]) => cards.length === 2 && handValue(cards).total === 21;

function draw(s: BlackjackState): number {
  if (s.pos >= s.shoe.length) throw new Error("shoe habis");
  return s.shoe[s.pos++];
}

function settle(cfg: BlackjackConfig, s: BlackjackState, result: Result): number {
  s.phase = "DONE";
  s.result = result;
  switch (result) {
    case "BLACKJACK": return s.wagered + Math.floor((s.wagered * cfg.blackjackNum) / cfg.blackjackDen);
    case "WIN":
    case "DEALER_BUST": return s.wagered * 2;
    case "PUSH": return s.wagered;
    default: return 0;
  }
}

function dealerPlayAndSettle(cfg: BlackjackConfig, s: BlackjackState): number {
  while (handValue(s.dealer).total < 17) s.dealer.push(draw(s));
  const d = handValue(s.dealer).total;
  const p = handValue(s.player).total;
  if (d > 21) return settle(cfg, s, "DEALER_BUST");
  if (p > d) return settle(cfg, s, "WIN");
  if (p < d) return settle(cfg, s, "LOSE");
  return settle(cfg, s, "PUSH");
}

function outcomeOf(s: BlackjackState, payout: number) {
  return {
    result: s.result, player: s.player, dealer: s.dealer,
    playerTotal: handValue(s.player).total, dealerTotal: handValue(s.dealer).total,
    wagered: s.wagered, doubled: s.doubled, payout,
  };
}

function validate(raw: unknown): ConfigCheck<BlackjackConfig> {
  const p = BlackjackConfigSchema.safeParse(raw);
  if (!p.success) return { ok: false, errors: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const c = p.data;
  const errors: string[] = [];
  if (c.minStake > c.maxStake) errors.push("minStake > maxStake");
  if (c.stakeSteps.some((s) => s < c.minStake || s > c.maxStake)) errors.push("stakeSteps di luar min/max");
  if (c.blackjackNum / c.blackjackDen > 1.5) errors.push("pembayaran blackjack maksimum 3:2");
  if (c.blackjackNum / c.blackjackDen < 1) errors.push("pembayaran blackjack minimum 1:1");
  return errors.length ? { ok: false, errors } : { ok: true, config: c };
}

export function newShoe(decks: number, rng: Rng): number[] {
  const cards: number[] = [];
  for (let d = 0; d < decks; d++) for (let c = 0; c < 52; c++) cards.push(c);
  return shuffle(cards, rng);
}

export const blackjackEngine: GameEngine<BlackjackConfig, BlackjackState> = {
  slug: "blackjack-21",
  kind: "INTERACTIVE",
  defaultConfig: blackjackDefaultConfig,
  validateConfig: validate,
  describe: (cfg) => ({
    minStake: cfg.minStake, maxStake: cfg.maxStake, stakeSteps: cfg.stakeSteps, decks: cfg.decks,
    blackjackPays: `${cfg.blackjackNum}:${cfg.blackjackDen}`, dealerStandsOn: "all 17", split: false, doubleDown: "first two cards",
  }),
  parseStart(raw, cfg) {
    const i = z.object({ stake: z.number().int() }).strict().parse(raw);
    if (i.stake < cfg.minStake || i.stake > cfg.maxStake) throw badRequest("STAKE_OUT_OF_RANGE");
    return i;
  },
  start(cfg, input, rng) {
    const s: BlackjackState = {
      shoe: newShoe(cfg.decks, rng), pos: 0, player: [], dealer: [],
      wagered: input.stake, doubled: false, phase: "PLAYER",
    };
    s.player.push(draw(s)); s.dealer.push(draw(s)); s.player.push(draw(s)); s.dealer.push(draw(s));
    const pbj = isBlackjack(s.player), dbj = isBlackjack(s.dealer);
    if (pbj || dbj) {
      const payout = settle(cfg, s, pbj && dbj ? "PUSH" : pbj ? "BLACKJACK" : "DEALER_BLACKJACK");
      return { state: s, stake: input.stake, finished: true, payout, outcome: outcomeOf(s, payout) };
    }
    return { state: s, stake: input.stake, finished: false, payout: 0, outcome: {} };
  },
  parseAction(raw) {
    return z.object({ type: z.enum(["hit", "stand", "double"]) }).strict().parse(raw);
  },
  act(cfg, state, action) {
    if (state.phase !== "PLAYER") throw badRequest("ROUND_FINISHED");
    const s: BlackjackState = JSON.parse(JSON.stringify(state));
    let extraStake = 0;
    let payout = 0;
    if (action.type === "hit") {
      s.player.push(draw(s));
      const v = handValue(s.player).total;
      if (v > 21) payout = settle(cfg, s, "BUST");
      else if (v === 21) payout = dealerPlayAndSettle(cfg, s);
    } else if (action.type === "stand") {
      payout = dealerPlayAndSettle(cfg, s);
    } else {
      if (s.player.length !== 2 || s.doubled) throw badRequest("DOUBLE_NOT_ALLOWED");
      extraStake = s.wagered;
      s.wagered += extraStake;
      s.doubled = true;
      s.player.push(draw(s));
      payout = handValue(s.player).total > 21 ? settle(cfg, s, "BUST") : dealerPlayAndSettle(cfg, s);
    }
    const finished = s.phase === "DONE";
    return { state: s, extraStake, finished, payout, outcome: finished ? outcomeOf(s, payout) : {} };
  },
  publicView(s, finished) {
    const hidden = !finished && s.phase === "PLAYER";
    return {
      player: s.player,
      dealer: hidden ? s.dealer.slice(0, 1) : s.dealer,
      dealerHiddenCards: hidden ? s.dealer.length - 1 : 0,
      playerTotal: handValue(s.player).total,
      playerSoft: handValue(s.player).soft,
      dealerTotal: hidden ? null : handValue(s.dealer).total,
      wagered: s.wagered, doubled: s.doubled, phase: s.phase, result: s.result ?? null,
      canDouble: s.phase === "PLAYER" && s.player.length === 2 && !s.doubled,
    };
  },
};
