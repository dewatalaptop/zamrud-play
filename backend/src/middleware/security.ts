import type { NextFunction, Request, RequestHandler, Response } from "express";
import { run } from "../db";
import { HttpError, forbidden, unauthorized } from "../lib/errors";
import { localDay } from "../lib/clock";
import { rateLimit } from "../lib/security";
import { createSession, resolveSession, SESSION_DAYS, type AuthUser } from "../services/auth";

// Hosting+Functions hanya meneruskan cookie bernama `__session` ke Cloud Function.
export const COOKIE = "__session";

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
    sessionToken?: string;
  }
}

export const securityHeaders: RequestHandler = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (req.url.startsWith("/api")) res.setHeader("Cache-Control", "no-store"); // jangan cache respons API
  next();
};

/** CSP + header keamanan untuk halaman statis (sama dengan konfigurasi header di firebase.json). */
export const CSP = [
  "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data:",
  "connect-src 'self' https://us-central1-ai-app-builder-7bf8e.cloudfunctions.net",
  "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
].join("; ");
export const staticHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
};

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function setSessionCookie(req: Request, res: Response, token: string, expiresAt: string) {
  const secure = process.env.NODE_ENV === "production" || req.headers["x-forwarded-proto"] === "https";
  const attrs = [`${COOKIE}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Expires=${new Date(expiresAt).toUTCString()}`];
  if (secure) attrs.push("Secure");
  res.append("Set-Cookie", attrs.join("; "));
}
export function clearSessionCookie(res: Response) {
  res.append("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** Perlindungan CSRF: cookie SameSite=Lax + header kustom wajib + cek Origin untuk metode mengubah data. */
export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.headers["x-zamrud-csrf"] !== "1") return next(forbidden("CSRF_REJECTED"));
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return next(forbidden("CSRF_REJECTED"));
    } catch {
      return next(forbidden("CSRF_REJECTED"));
    }
  }
  next();
};

/** Memuat pengguna dari cookie sesi (tanpa menolak); sliding expiry. */
export const attachUser: RequestHandler = (req, res, next) => {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) {
    const s = resolveSession(token);
    if (s) {
      req.user = s.user;
      req.sessionToken = token;
      const remaining = Date.parse(s.expiresAt) - Date.now();
      if (remaining < (SESSION_DAYS / 2) * 86_400_000) {
        // Perpanjang: terbitkan sesi baru, cabut yang lama.
        const fresh = createSession(s.user.id, req.headers["user-agent"]);
        run("DELETE FROM auth_sessions WHERE id=?", s.sessionId);
        setSessionCookie(req, res, fresh.token, fresh.expiresAt);
        req.sessionToken = fresh.token;
      }
    }
  }
  next();
};

export const requireUser: RequestHandler = (req, _res, next) => (req.user ? next() : next(unauthorized()));
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== "ADMIN") return next(forbidden("ADMIN_ONLY"));
  next();
};

export const clientIp = (req: Request) => String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "ip").split(",")[0].trim();

/** Pembatas laju per kelompok rute. */
export function limit(name: string, max: number, windowMs: number, by: "ip" | "user" = "ip"): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const who = by === "user" && req.user ? req.user.id : clientIp(req);
    if (!rateLimit(`${name}:${who}`, max, windowMs)) return next(new HttpError(429, "RATE_LIMITED"));
    next();
  };
}

/** Metrik error sederhana per hari (dipakai dashboard admin untuk angka error rate nyata). */
export const metrics: RequestHandler = (req, res, next) => {
  res.on("finish", () => {
    if (!req.path.startsWith("/api/") || req.path === "/api/health") return;
    try {
      run(
        "INSERT INTO api_metrics(day,total,errors) VALUES(?,1,?) ON CONFLICT(day) DO UPDATE SET total=total+1, errors=errors+excluded.errors",
        localDay(), res.statusCode >= 500 ? 1 : 0
      );
    } catch { /* metrik tidak boleh mengganggu respons */ }
  });
  next();
};
