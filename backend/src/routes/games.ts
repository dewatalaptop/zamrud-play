import { Router } from "express";
import { z } from "zod";
import { all, one, tx } from "../db";
import { notFound } from "../lib/errors";
import { getEngine } from "../games/registry";
import { limit, requireUser } from "../middleware/security";
import { actOnRound, getActiveRound, getRound, loadConfig, startRound } from "../services/gameplay";
import { evaluateAchievements, incCounter, track, trackMission, getCounter } from "../services/progress";
import { h, uid } from "./util";

export const gamesRouter = Router();
export const sessionsRouter = Router();

function shape(g: any) {
  const engine = getEngine(g.slug)!;
  const config = loadConfig(g.id, g.active_config_version);
  return {
    slug: g.slug, category: g.category, kind: g.kind, tags: JSON.parse(g.tags), difficulty: g.difficulty,
    name: { id: g.name_id, en: g.name_en }, description: { id: g.desc_id, en: g.desc_en },
    configVersion: g.active_config_version, rules: engine.describe(config),
  };
}

gamesRouter.get("/", h(() => all<any>("SELECT * FROM games WHERE enabled=1 ORDER BY sort_order").map(shape)));

gamesRouter.get("/:slug", h((req) => {
  const g = one<any>("SELECT * FROM games WHERE slug=? AND enabled=1", String(req.params.slug));
  if (!g) throw notFound("GAME_NOT_FOUND");
  return shape(g);
}));

gamesRouter.post("/:slug/rules-viewed", requireUser, limit("rules", 60, 60_000, "user"), h((req) => {
  const g = one<any>("SELECT id,slug FROM games WHERE slug=?", String(req.params.slug));
  if (!g) throw notFound("GAME_NOT_FOUND");
  const id = uid(req);
  tx(() => {
    if (!getCounter(id, `rules:${g.slug}`)) incCounter(id, `rules:${g.slug}`);
    trackMission(id, "REVIEW_RULES", g.slug);
    evaluateAchievements(id);
  });
}));

gamesRouter.get("/:slug/active", requireUser, h((req) => getActiveRound(uid(req), String(req.params.slug))));

gamesRouter.post("/:slug/sessions", requireUser, limit("rounds", 90, 60_000, "user"), h((req) => {
  const b = z.object({ requestId: z.string().min(8).max(64), input: z.unknown() }).strict().parse(req.body);
  return startRound(uid(req), String(req.params.slug), b.input, b.requestId);
}));

sessionsRouter.use(requireUser);
sessionsRouter.get("/:id", h((req) => getRound(uid(req), String(req.params.id))));
sessionsRouter.post("/:id/actions", limit("actions", 120, 60_000, "user"), h((req) => {
  const b = z.object({ clientActionId: z.string().min(8).max(64), expectedSeq: z.number().int(), action: z.unknown() }).strict().parse(req.body);
  return actOnRound(uid(req), String(req.params.id), { ...b, action: b.action });
}));
export { track };
