import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { reportServerError } from "../lib/bugReporter";
import { HttpError } from "../lib/errors";

// Format error konsisten: { ok:false, error:{ code, message, ... } }. `code` diterjemahkan di frontend.
// Pesan 5xx tidak pernah membocorkan detail internal.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Input tidak valid", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } });
    return;
  }
  if (err instanceof HttpError) {
    if (err.status >= 500) reportServerError(err, { route: `${req.method} ${req.route?.path ?? req.path}` });
    res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, ...(err.extra ?? {}) } });
    return;
  }
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ ok: false, error: { code: "INVALID_JSON", message: "JSON tidak valid" } });
    return;
  }
  if ((err as any)?.type === "entity.too.large") {
    res.status(413).json({ ok: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Payload terlalu besar" } });
    return;
  }
  console.error(err);
  // Rute saja (tanpa query/body) — pelapor tidak boleh membawa data pengguna.
  reportServerError(err, { route: `${req.method} ${req.route?.path ?? req.path}` });
  res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan pada server" } });
};
