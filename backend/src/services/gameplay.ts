import { all, one, run, tx } from "../db";
import { iso } from "../lib/clock";
import { badRequest, conflict, forbidden, HttpError, notFound } from "../lib/errors";
import { newId } from "../lib/security";
import { getEngine } from "../games/registry";
import { secureRng } from "../games/rng";
import type { Rng } from "../games/types";
import { applyLedger, getBalance } from "./wallet";
import { assertCanStartRound, markRoundEnded } from "./responsible";
import { awardRoundXp, evaluateAchievements, track, trackMission } from "./progress";
import { ZodError } from "zod";

// RNG disuntik: produksi memakai CSPRNG; tes boleh menggantinya (deterministik).
let rng: Rng = secureRng;
export const setRng = (r: Rng | null) => { rng = r ?? secureRng; };

interface GameRow { id: string; slug: string; category: string; kind: string; enabled: number; active_config_version: number; }
interface SessionRow {
  id: string; user_id: string; game_id: string; config_version: number; request_id: string; state: string;
  status: "ACTIVE" | "COMPLETED"; stake: number; payout: number; seq: number; started_at: string; ended_at: string | null;
}

function loadGame(slug: string): GameRow {
  const g = one<GameRow>("SELECT id,slug,category,kind,enabled,active_config_version FROM games WHERE slug=?", slug);
  if (!g) throw notFound("GAME_NOT_FOUND");
  return g;
}

export function loadConfig(gameId: string, version: number): any {
  const row = one<{ config: string }>("SELECT config FROM game_configs WHERE game_id=? AND version=?", gameId, version);
  if (!row) throw new HttpError(500, "CONFIG_MISSING");
  return JSON.parse(row.config);
}

function parseWith<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof ZodError) throw badRequest("VALIDATION_ERROR", { issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
    throw e;
  }
}

/** Respons sesi untuk klien: tidak pernah memuat shoe/kartu tersembunyi. */
function present(s: SessionRow, slug: string, extra: Record<string, unknown> = {}) {
  const engine = getEngine(slug)!;
  const state = JSON.parse(s.state);
  const finished = s.status === "COMPLETED";
  return {
    sessionId: s.id, game: slug, status: s.status, stake: s.stake, payout: s.payout, net: finished ? s.payout - s.stake : null,
    seq: s.seq, configVersion: s.config_version, view: engine.publicView(state, finished),
    balance: getBalance(s.user_id), ...extra,
  };
}

export function startRound(userId: string, slug: string, rawInput: unknown, requestId: string) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(requestId)) throw badRequest("INVALID_REQUEST_ID");
  return tx(() => {
    const game = loadGame(slug);
    const engine = getEngine(slug);
    if (!engine) throw notFound("GAME_NOT_FOUND");

    // Replay permintaan yang sama -> kembalikan hasil yang tersimpan, tanpa memotong saldo lagi.
    const existing = one<SessionRow>("SELECT * FROM game_sessions WHERE user_id=? AND request_id=?", userId, requestId);
    if (existing) {
      if (existing.game_id !== game.id) throw conflict("REQUEST_ID_REUSED");
      return present(existing, slug, { replay: true });
    }

    if (!game.enabled) throw forbidden("GAME_DISABLED");
    const active = one<SessionRow>("SELECT * FROM game_sessions WHERE user_id=? AND game_id=? AND status='ACTIVE'", userId, game.id);
    if (active) throw conflict("ROUND_IN_PROGRESS", { sessionId: active.id });
    assertCanStartRound(userId);

    const config = loadConfig(game.id, game.active_config_version);
    const input = parseWith(() => engine.parseStart(rawInput, config));
    const result = engine.start(config, input, rng);

    const sid = newId();
    const at = iso();
    run(
      `INSERT INTO game_sessions(id,user_id,game_id,config_version,request_id,state,status,stake,payout,seq,started_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      sid, userId, game.id, game.active_config_version, requestId, JSON.stringify(result.state), "ACTIVE", result.stake, 0, 0, at
    );
    // Potong taruhan: gagal (saldo kurang) -> seluruh transaksi di-rollback, tidak ada sesi tersisa.
    applyLedger({ userId, type: "GAME_STAKE", amount: -result.stake, key: `stake:${sid}`, sessionId: sid, meta: { game: slug } });
    track(userId, "GAME_STARTED", game.id);
    if (result.finished) finish(userId, game, sid, result.payout, result.outcome);
    return present(one<SessionRow>("SELECT * FROM game_sessions WHERE id=?", sid)!, slug);
  });
}

function finish(userId: string, game: GameRow, sid: string, payout: number, outcome: Record<string, unknown>) {
  const s = one<SessionRow>("SELECT * FROM game_sessions WHERE id=?", sid)!;
  if (payout > 0) {
    applyLedger({ userId, type: "GAME_PAYOUT", amount: payout, key: `payout:${sid}`, sessionId: sid, meta: { game: game.slug } });
  }
  const at = iso();
  run("UPDATE game_sessions SET status='COMPLETED', payout=?, ended_at=? WHERE id=?", payout, at, sid);
  // Taruhan total (termasuk double) tersimpan di sesi: perbarui bila bertambah.
  const staked = one<{ t: number }>(
    "SELECT COALESCE(-SUM(amount),0) t FROM wallet_transactions WHERE game_session_id=? AND type='GAME_STAKE'", sid
  )!.t;
  run("UPDATE game_sessions SET stake=? WHERE id=?", staked, sid);
  run(
    "INSERT INTO game_results(session_id,user_id,game_id,config_version,stake,payout,net,outcome,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
    sid, userId, game.id, s.config_version, staked, payout, payout - staked, JSON.stringify(outcome), at
  );
  markRoundEnded(userId);
  track(userId, "GAME_COMPLETED", game.id);
  awardRoundXp(userId);
  trackMission(userId, "COMPLETE_SESSION");
  trackMission(userId, "DISTINCT_GAMES", game.slug);
  trackMission(userId, "DISTINCT_CATEGORIES", game.category);
  evaluateAchievements(userId);
}

export function actOnRound(userId: string, sessionId: string, body: { clientActionId: string; expectedSeq: number; action: unknown }) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(body.clientActionId ?? "")) throw badRequest("INVALID_REQUEST_ID");
  return tx(() => {
    // IDOR: sesi milik orang lain diperlakukan seolah tidak ada.
    const s = one<SessionRow>("SELECT * FROM game_sessions WHERE id=? AND user_id=?", sessionId, userId);
    if (!s) throw notFound("SESSION_NOT_FOUND");
    const game = one<GameRow>("SELECT id,slug,category,kind,enabled,active_config_version FROM games WHERE id=?", s.game_id)!;
    const engine = getEngine(game.slug);
    if (!engine?.act || !engine.parseAction) throw badRequest("NOT_INTERACTIVE");

    const replay = one<{ response: string }>("SELECT response FROM game_actions WHERE session_id=? AND client_action_id=?", s.id, body.clientActionId);
    if (replay) return { ...JSON.parse(replay.response), replay: true, balance: getBalance(userId) };

    if (s.status !== "ACTIVE") throw conflict("ROUND_FINISHED");
    if (!Number.isInteger(body.expectedSeq) || body.expectedSeq !== s.seq) throw conflict("STALE_ACTION", { seq: s.seq });

    const action = parseWith(() => engine.parseAction!(body.action));
    const config = loadConfig(s.game_id, s.config_version); // aturan sesi tidak berubah di tengah ronde
    const state = JSON.parse(s.state);
    const r = engine.act(config, state, action, rng);

    if (r.extraStake > 0) {
      applyLedger({ userId, type: "GAME_STAKE", amount: -r.extraStake, key: `stake:${s.id}:${s.seq + 1}`, sessionId: s.id, meta: { game: game.slug, action: action.type } });
    }
    run("UPDATE game_sessions SET state=?, seq=seq+1 WHERE id=?", JSON.stringify(r.state), s.id);
    if (r.finished) finish(userId, game, s.id, r.payout, r.outcome);
    const fresh = one<SessionRow>("SELECT * FROM game_sessions WHERE id=?", s.id)!;
    const response = present(fresh, game.slug);
    run(
      "INSERT INTO game_actions(id,session_id,seq,client_action_id,type,payload,response,created_at) VALUES(?,?,?,?,?,?,?,?)",
      newId(), s.id, s.seq + 1, body.clientActionId, action.type, JSON.stringify(action), JSON.stringify(response), iso()
    );
    return response;
  });
}

export function getRound(userId: string, sessionId: string) {
  const s = one<SessionRow>("SELECT * FROM game_sessions WHERE id=? AND user_id=?", sessionId, userId);
  if (!s) throw notFound("SESSION_NOT_FOUND");
  const slug = one<{ slug: string }>("SELECT slug FROM games WHERE id=?", s.game_id)!.slug;
  return present(s, slug);
}

export function getActiveRound(userId: string, slug: string) {
  const game = loadGame(slug);
  const s = one<SessionRow>("SELECT * FROM game_sessions WHERE user_id=? AND game_id=? AND status='ACTIVE'", userId, game.id);
  return s ? present(s, slug) : null;
}

export function listHistory(userId: string, opts: { limit: number; cursor?: string | null; game?: string | null }) {
  const limit = Math.min(Math.max(opts.limit, 1), 100);
  const cur = opts.cursor && /^\d+$/.test(opts.cursor) ? Number(opts.cursor) : null;
  const rows = all<any>(
    `SELECT r.rowid rid, r.session_id, g.slug, g.name_id, g.name_en, r.stake, r.payout, r.net, r.outcome, r.config_version, r.created_at
     FROM game_results r JOIN games g ON g.id=r.game_id
     WHERE r.user_id=? ${opts.game ? "AND g.slug=?" : ""} ${cur !== null ? "AND r.rowid < ?" : ""}
     ORDER BY r.rowid DESC LIMIT ?`,
    ...([userId, ...(opts.game ? [opts.game] : []), ...(cur !== null ? [cur] : []), limit + 1] as (string | number)[])
  );
  const page = rows.slice(0, limit);
  return {
    items: page.map((r) => ({
      sessionId: r.session_id, game: r.slug, name: { id: r.name_id, en: r.name_en }, stake: r.stake, payout: r.payout, net: r.net,
      outcome: JSON.parse(r.outcome), configVersion: r.config_version, createdAt: r.created_at,
    })),
    nextCursor: rows.length > limit ? String(page[page.length - 1].rid) : null,
  };
}
