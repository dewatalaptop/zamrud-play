import { Router } from "express";
import { z } from "zod";
import { tx } from "../db";
import { requireUser } from "../middleware/security";
import { claimMission, evaluateAchievements, incCounter, listAchievements, listMissions } from "../services/progress";
import { getStatistics, leaderboard } from "../services/stats";
import { listHistory } from "../services/gameplay";
import { h, PageQuery, uid } from "./util";

export const progressRouter = Router();

// Papan peringkat publik: hanya nama tampilan + XP (poin kemajuan, bukan koin) dari pemain yang mengizinkan.
progressRouter.get("/leaderboard", h(() => leaderboard(20)));

progressRouter.get("/missions", requireUser, h((req) => listMissions(uid(req))));
progressRouter.post("/missions/:id/claim", requireUser, h((req) => {
  const b = z.object({ periodKey: z.string().min(3).max(12) }).strict().parse(req.body);
  return claimMission(uid(req), String(req.params.id), b.periodKey);
}));
progressRouter.get("/achievements", requireUser, h((req) => listAchievements(uid(req))));
progressRouter.get("/statistics", requireUser, h((req) => getStatistics(uid(req))));
progressRouter.post("/statistics/view", requireUser, h((req) => {
  tx(() => {
    incCounter(uid(req), "stats_viewed");
    evaluateAchievements(uid(req));
  });
}));
progressRouter.get("/history", requireUser, h((req) => {
  const q = PageQuery.extend({ game: z.string().max(40).optional() }).parse(req.query);
  return listHistory(uid(req), { limit: q.limit, cursor: q.cursor, game: q.game });
}));
