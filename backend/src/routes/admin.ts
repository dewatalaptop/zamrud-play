import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/security";
import * as admin from "../services/admin";
import { h, PageNumQuery, uid } from "./util";

export const adminRouter = Router();
// Semua rute admin: wajib login + peran ADMIN, divalidasi di server pada setiap permintaan.
adminRouter.use(requireAdmin);

const reason = z.object({ reason: z.string().trim().min(5).max(300) });

adminRouter.get("/analytics", h((req) => admin.analytics(admin.RangeSchema.parse(req.query.days))));

adminRouter.get("/users", h((req) => {
  const q = PageNumQuery.extend({ q: z.string().trim().max(60).default("") }).parse(req.query);
  return admin.listUsers(q.q, q.page, q.pageSize);
}));
adminRouter.get("/users/:id", h((req) => admin.userDetail(String(req.params.id))));
adminRouter.post("/users/:id/status", h((req) => {
  const b = reason.extend({ status: z.enum(["ACTIVE", "SUSPENDED"]) }).strict().parse(req.body);
  return admin.setUserStatus(uid(req), String(req.params.id), b.status, b.reason);
}));
adminRouter.post("/users/:id/adjust-balance", h((req) => {
  const b = reason.extend({ amount: z.number().int() }).strict().parse(req.body);
  return admin.adjustBalance(uid(req), String(req.params.id), b.amount, b.reason);
}));
adminRouter.post("/users/:id/demo-reset", h((req) => {
  const b = reason.strict().parse(req.body);
  return admin.demoReset(uid(req), String(req.params.id), b.reason);
}));

adminRouter.get("/games", h(() => admin.listGamesAdmin()));
adminRouter.patch("/games/:id", h((req) => admin.updateGameMeta(uid(req), String(req.params.id), req.body)));
adminRouter.post("/games/:id/validate", h((req) => admin.validateGameConfig(String(req.params.id), (req.body as any)?.config)));
adminRouter.post("/games/:id/configs", h((req) => admin.createDraft(uid(req), String(req.params.id), (req.body as any)?.config)));
adminRouter.post("/games/:id/configs/:version/publish", h((req) => {
  const b = reason.strict().parse(req.body);
  return admin.publishConfig(uid(req), String(req.params.id), Number(req.params.version), b.reason);
}));

adminRouter.get("/missions", h(() => admin.listMissionsAdmin()));
adminRouter.post("/missions", h((req) => admin.createMission(uid(req), req.body)));
adminRouter.patch("/missions/:id", h((req) => admin.updateMission(uid(req), String(req.params.id), req.body)));

adminRouter.get("/economy", h(() => admin.economyOverview()));
adminRouter.put("/economy", h((req) => {
  const b = z.object({ reason: z.string(), economy: z.unknown() }).strict().parse(req.body);
  return admin.updateEconomy(uid(req), b.economy, b.reason);
}));
adminRouter.post("/promos", h((req) => admin.createPromo(uid(req), req.body)));
adminRouter.post("/promos/:id/active", h((req) => {
  const b = z.object({ active: z.boolean() }).strict().parse(req.body);
  admin.setPromoActive(uid(req), String(req.params.id), b.active);
}));

adminRouter.get("/audit-logs", h((req) => {
  const q = PageNumQuery.parse(req.query);
  return admin.listAudit(q.page, q.pageSize);
}));
adminRouter.get("/support", h((req) => admin.listSupport(req.query.status ? z.enum(["OPEN", "RESOLVED"]).parse(req.query.status) : null)));
adminRouter.post("/support/:id/resolve", h((req) => {
  const b = z.object({ note: z.string().trim().min(2).max(500) }).strict().parse(req.body);
  admin.resolveSupport(uid(req), String(req.params.id), b.note);
}));
