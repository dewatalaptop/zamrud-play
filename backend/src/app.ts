import express from "express";
import fs from "fs";
import path from "path";
import { errorHandler } from "./middleware/errorHandler";
import { attachUser, csrfGuard, limit, metrics, securityHeaders, staticHeaders } from "./middleware/security";
import { authRouter } from "./routes/auth";
import { meRouter } from "./routes/me";
import { gamesRouter, sessionsRouter } from "./routes/games";
import { walletRouter } from "./routes/wallet";
import { progressRouter } from "./routes/progress";
import { adminRouter } from "./routes/admin";
import { db } from "./db";
import { seedAll } from "./seed";
import { HttpError } from "./lib/errors";

seedAll();

export const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Tanpa CORS: frontend dan API same-origin (Hosting rewrite /api/**). Cross-site ditolak csrfGuard.
app.use(securityHeaders);
app.use(express.json({ limit: "32kb" }));
app.use(metrics);

app.get("/api/health", (_req, res) => {
  const row = db.prepare("SELECT COUNT(*) c FROM games").get() as { c: number };
  res.json({ ok: true, data: { status: "up", games: row.c } });
});

app.use("/api", limit("global", 600, 60_000), csrfGuard, attachUser);
app.use("/api/auth", authRouter);
app.use("/api/me", meRouter);
app.use("/api/games", gamesRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/wallet", walletRouter);
app.use("/api", progressRouter);
app.use("/api/admin", adminRouter);

app.use("/api", (_req, _res, next) => next(new HttpError(404, "NOT_FOUND")));

// Sajikan frontend hasil build bila ada (mode satu-server: lokal/produksi mandiri). Di Firebase,
// Hosting yang menyajikan file statis dan hanya /api/** yang diteruskan ke fungsi ini.
const staticDir = process.env.STATIC_DIR || path.join(__dirname, "..", "..", "frontend", "dist");
if (fs.existsSync(path.join(staticDir, "index.html"))) {
  app.use(staticHeaders);
  app.use(express.static(staticDir, { index: false, maxAge: "1h", setHeaders: (res, file) => { if (file.endsWith("index.html")) res.setHeader("Cache-Control", "no-cache"); } }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(staticDir, "index.html")));
}

// Keep this LAST — error middleware dikenali dari signature 4-argumen.
app.use(errorHandler);
