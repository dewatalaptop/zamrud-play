import { Router } from "express";
import { z } from "zod";
import { tx } from "../db";
import { limit, requireUser } from "../middleware/security";
import { claimDaily, dailyStatus, getBalance, listTransactions, redeemPromo } from "../services/wallet";
import { trackMission } from "../services/progress";
import { h, PageQuery, uid } from "./util";

export const walletRouter = Router();
walletRouter.use(requireUser);

walletRouter.get("/", h((req) => ({ balance: getBalance(uid(req)), daily: dailyStatus(uid(req)) })));

walletRouter.get("/transactions", h((req) => {
  const q = PageQuery.extend({ type: z.enum(["INITIAL_GRANT", "GAME_STAKE", "GAME_PAYOUT", "DAILY_REWARD", "MISSION_REWARD", "PROMO_REWARD", "ADMIN_ADJUSTMENT", "DEMO_RESET"]).optional() }).parse(req.query);
  return listTransactions(uid(req), { limit: q.limit, cursor: q.cursor, type: q.type });
}));

walletRouter.post("/daily-claim", limit("claim", 20, 60_000, "user"), h((req) => {
  const out = tx(() => {
    const r = claimDaily(uid(req));
    trackMission(uid(req), "CLAIM_DAILY");
    return r;
  });
  return { ...out, daily: dailyStatus(uid(req)) };
}));

walletRouter.post("/promo", limit("promo", 10, 10 * 60_000, "user"), h((req) => {
  const b = z.object({ code: z.string().trim().min(3).max(32) }).strict().parse(req.body);
  return redeemPromo(uid(req), b.code);
}));
