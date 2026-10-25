// Sends this server's own crashes to the App Builder (see
// templates/shared/bug-reporter and functions/src/bugReports.ts). Needs two env
// vars, printed by `node local-worker/job.js register-app`:
//   BUG_APP_ID, BUG_APP_KEY   (optional: BUG_APP_VERSION, BUG_ENDPOINT)
// Without them it does nothing, so local dev is unaffected.
const ENDPOINT = process.env.BUG_ENDPOINT ?? "https://us-central1-ai-app-builder-7bf8e.cloudfunctions.net/reportAppError";

let sent = 0;
const seen = new Map<string, number>();

export function reportServerError(err: unknown, context: Record<string, string | number | boolean> = {}): void {
  const appId = process.env.BUG_APP_ID;
  const key = process.env.BUG_APP_KEY;
  if (!appId || !key || sent >= 50) return;
  const e = err instanceof Error ? err : new Error(String(err));
  const dedupe = `${e.message}|${(e.stack ?? "").split("\n")[1] ?? ""}`;
  const last = seen.get(dedupe) ?? 0;
  if (Date.now() - last < 5 * 60_000) return; // same error: once per 5 minutes
  seen.set(dedupe, Date.now());
  sent++;
  // Fire and forget with a short timeout — reporting must never slow or break a request.
  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appId,
      key,
      kind: "server",
      platform: "backend",
      version: process.env.BUG_APP_VERSION ?? "",
      message: e.message.slice(0, 400),
      stack: (e.stack ?? "").slice(0, 4000),
      context: { node: process.version, ...context },
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

export function installProcessHandlers(): void {
  process.on("uncaughtException", (err) => {
    console.error(err);
    reportServerError(err, { fatal: true });
    // Give the report a moment to leave, then exit like Node would have.
    setTimeout(() => process.exit(1), 600).unref();
  });
  process.on("unhandledRejection", (reason) => {
    console.error(reason);
    reportServerError(reason);
  });
}
