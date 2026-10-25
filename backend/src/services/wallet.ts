import { all, one, run, tx } from "../db";
import { iso, localDay, startOfLocalDayIso } from "../lib/clock";
import { conflict, HttpError, notFound } from "../lib/errors";
import { newId } from "../lib/security";
import { getEconomy } from "./settings";

export type TxType =
  | "INITIAL_GRANT" | "GAME_STAKE" | "GAME_PAYOUT" | "DAILY_REWARD"
  | "MISSION_REWARD" | "PROMO_REWARD" | "ADMIN_ADJUSTMENT" | "DEMO_RESET";

export interface LedgerInput {
  userId: string;
  type: TxType;
  /** Bertanda: positif = koin masuk, negatif = koin keluar. */
  amount: number;
  /** Kunci idempotensi unik: pemrosesan ulang kunci yang sama tidak mengubah saldo. */
  key: string;
  sessionId?: string;
  meta?: Record<string, unknown>;
  note?: string;
}
export interface LedgerResult { balance: number; duplicate: boolean; txId: string; }

/**
 * SATU-SATUNYA jalan mengubah saldo. Wajib dipanggil di dalam tx() (transaksi tulis tunggal).
 * Urutan: cek kunci idempotensi -> baca saldo -> tolak bila hasilnya negatif -> update bersyarat
 * (balance harus masih sama) -> tulis entri ledger dengan balance_after. CHECK(balance >= 0) di DB
 * menjadi lapisan pertahanan terakhir.
 */
export function applyLedger(input: LedgerInput): LedgerResult {
  if (!Number.isInteger(input.amount) || input.amount === 0) throw new HttpError(500, "INVALID_AMOUNT");
  return tx(() => {
    const dup = one<{ id: string; balance_after: number }>(
      "SELECT id, balance_after FROM wallet_transactions WHERE idempotency_key=?", input.key
    );
    if (dup) return { balance: dup.balance_after, duplicate: true, txId: dup.id };
    const w = one<{ balance: number }>("SELECT balance FROM wallets WHERE user_id=?", input.userId);
    if (!w) throw notFound("WALLET_NOT_FOUND");
    const next = w.balance + input.amount;
    if (next < 0) throw new HttpError(402, "INSUFFICIENT_BALANCE", "INSUFFICIENT_BALANCE", { balance: w.balance });
    const upd = run(
      "UPDATE wallets SET balance=?, updated_at=? WHERE user_id=? AND balance=?",
      next, iso(), input.userId, w.balance
    );
    if (Number(upd.changes) !== 1) throw conflict("WALLET_CONFLICT");
    const id = newId();
    run(
      `INSERT INTO wallet_transactions(id,user_id,type,amount,balance_after,idempotency_key,game_session_id,meta,note,created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      id, input.userId, input.type, input.amount, next, input.key,
      input.sessionId ?? null, JSON.stringify(input.meta ?? {}), input.note ?? null, iso()
    );
    return { balance: next, duplicate: false, txId: id };
  });
}

export function getBalance(userId: string): number {
  return one<{ balance: number }>("SELECT balance FROM wallets WHERE user_id=?", userId)?.balance ?? 0;
}

export function createWallet(userId: string, startingBalance: number) {
  run("INSERT INTO wallets(user_id,balance,updated_at) VALUES(?,0,?)", userId, iso());
  if (startingBalance > 0) {
    applyLedger({ userId, type: "INITIAL_GRANT", amount: startingBalance, key: `initial:${userId}`, meta: { reason: "welcome" } });
  }
}

/** Hadiah harian gratis: maksimal `dailyRewardMaxPerDay` per hari lokal. */
export function claimDaily(userId: string): { balance: number; amount: number } {
  return tx(() => {
    const eco = getEconomy();
    if (eco.dailyReward <= 0) throw conflict("DAILY_DISABLED");
    const day = localDay();
    const count = one<{ c: number }>(
      "SELECT COUNT(*) c FROM wallet_transactions WHERE user_id=? AND type='DAILY_REWARD' AND created_at>=?",
      userId, startOfLocalDayIso()
    )!.c;
    if (count >= eco.dailyRewardMaxPerDay) throw conflict("ALREADY_CLAIMED", { nextAt: nextDayIso() });
    const r = applyLedger({
      userId, type: "DAILY_REWARD", amount: eco.dailyReward, key: `daily:${userId}:${day}:${count + 1}`,
      meta: { day, n: count + 1 },
    });
    if (r.duplicate) throw conflict("ALREADY_CLAIMED", { nextAt: nextDayIso() });
    return { balance: r.balance, amount: eco.dailyReward };
  });
}

function nextDayIso(): string {
  return new Date(Date.parse(startOfLocalDayIso()) + 86_400_000).toISOString();
}

export function dailyStatus(userId: string) {
  const eco = getEconomy();
  const count = one<{ c: number }>(
    "SELECT COUNT(*) c FROM wallet_transactions WHERE user_id=? AND type='DAILY_REWARD' AND created_at>=?",
    userId, startOfLocalDayIso()
  )!.c;
  return { amount: eco.dailyReward, claimedToday: count, maxPerDay: eco.dailyRewardMaxPerDay, canClaim: eco.dailyReward > 0 && count < eco.dailyRewardMaxPerDay, nextAt: nextDayIso() };
}

/** Kode promo demo gratis: satu kali per pengguna, dibatasi kuota & kedaluwarsa. */
export function redeemPromo(userId: string, rawCode: string): { balance: number; amount: number } {
  return tx(() => {
    const code = rawCode.trim();
    const promo = one<{ id: string; reward_coins: number; max_redemptions: number; redeemed_count: number; expires_at: string | null; active: number }>(
      "SELECT * FROM promo_codes WHERE code=?", code
    );
    if (!promo || !promo.active) throw notFound("PROMO_INVALID");
    if (promo.expires_at && promo.expires_at < iso()) throw conflict("PROMO_EXPIRED");
    if (promo.redeemed_count >= promo.max_redemptions) throw conflict("PROMO_EXHAUSTED");
    if (one("SELECT 1 x FROM promo_redemptions WHERE promo_id=? AND user_id=?", promo.id, userId)) throw conflict("PROMO_ALREADY_USED");
    const r = applyLedger({
      userId, type: "PROMO_REWARD", amount: promo.reward_coins, key: `promo:${promo.id}:${userId}`,
      meta: { code: code.toUpperCase() },
    });
    if (r.duplicate) throw conflict("PROMO_ALREADY_USED");
    run("INSERT INTO promo_redemptions(id,promo_id,user_id,created_at) VALUES(?,?,?,?)", newId(), promo.id, userId, iso());
    run("UPDATE promo_codes SET redeemed_count=redeemed_count+1 WHERE id=?", promo.id);
    return { balance: r.balance, amount: promo.reward_coins };
  });
}

export function listTransactions(userId: string, opts: { limit: number; cursor?: string | null; type?: string | null }) {
  const limit = Math.min(Math.max(opts.limit, 1), 100);
  const cur = opts.cursor && /^\d+$/.test(opts.cursor) ? Number(opts.cursor) : null; // rowid (append-only, monoton)
  const rows = all<any>(
    `SELECT rowid rid,id,type,amount,balance_after,game_session_id,meta,note,created_at FROM wallet_transactions
     WHERE user_id=? ${opts.type ? "AND type=?" : ""} ${cur !== null ? "AND rowid < ?" : ""}
     ORDER BY rowid DESC LIMIT ?`,
    ...([userId, ...(opts.type ? [opts.type] : []), ...(cur !== null ? [cur] : []), limit + 1] as (string | number)[])
  );
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const items = page.map((r) => ({
    id: r.id, type: r.type, amount: r.amount, balanceAfter: r.balance_after, sessionId: r.game_session_id,
    meta: JSON.parse(r.meta), note: r.note, createdAt: r.created_at,
  }));
  return { items, nextCursor: hasMore ? String(page[page.length - 1].rid) : null };
}

/** Rekonsiliasi: saldo harus sama dengan jumlah ledger dan balance_after entri terakhir. */
export function reconcile(): { userId: string; balance: number; ledgerSum: number; lastBalanceAfter: number | null }[] {
  return all<any>(
    `SELECT w.user_id userId, w.balance balance,
            COALESCE((SELECT SUM(amount) FROM wallet_transactions t WHERE t.user_id=w.user_id),0) ledgerSum,
            (SELECT balance_after FROM wallet_transactions t WHERE t.user_id=w.user_id ORDER BY rowid DESC LIMIT 1) lastBalanceAfter
     FROM wallets w`
  ).filter((r) => r.balance !== r.ledgerSum || (r.lastBalanceAfter !== null && r.lastBalanceAfter !== r.balance));
}
