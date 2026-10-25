import { Router } from "express";
import { z } from "zod";
import { createSession, destroySession, login, register, changePassword, deleteAccount } from "../services/auth";
import { clearSessionCookie, clientIp, limit, requireUser, setSessionCookie } from "../middleware/security";
import { rateLimit } from "../lib/security";
import { HttpError } from "../lib/errors";
import { h, uid } from "./util";
import { heartbeat } from "../services/responsible";

export const authRouter = Router();

authRouter.post("/register", limit("register", 8, 60 * 60_000), h(async (req, res) => {
  const user = await register(req.body);
  const s = createSession(user.id, req.headers["user-agent"]);
  setSessionCookie(req, res, s.token, s.expiresAt);
  return { id: user.id };
}));

authRouter.post("/login", limit("login-ip", 20, 10 * 60_000), h(async (req, res) => {
  // Pembatas kedua per identitas yang dicoba (anti brute-force terarah).
  const ident = String((req.body as any)?.identifier ?? "").toLowerCase().slice(0, 120);
  if (!rateLimit(`login-id:${ident}`, 8, 10 * 60_000)) throw new HttpError(429, "RATE_LIMITED");
  const user = await login(req.body);
  const s = createSession(user.id, req.headers["user-agent"]);
  setSessionCookie(req, res, s.token, s.expiresAt);
  return { id: user.id, role: user.role };
}));

authRouter.post("/logout", h((req, res) => {
  if (req.sessionToken) destroySession(req.sessionToken);
  clearSessionCookie(res);
  return null;
}));

authRouter.post("/change-password", requireUser, limit("pw", 6, 60 * 60_000, "user"), h(async (req) => {
  const b = z.object({ current: z.string().min(1).max(128), next: z.string().min(8).max(128) }).strict().parse(req.body);
  await changePassword(uid(req), b.current, b.next);
}));

authRouter.post("/delete-account", requireUser, limit("del", 3, 60 * 60_000, "user"), h(async (req, res) => {
  const b = z.object({ password: z.string().min(1).max(128) }).strict().parse(req.body);
  await deleteAccount(uid(req), b.password);
  clearSessionCookie(res);
}));

authRouter.post("/heartbeat", requireUser, limit("hb", 30, 60_000, "user"), h((req, res) => { res.locals.noSync = true; return heartbeat(uid(req)); }));
export { clientIp };
