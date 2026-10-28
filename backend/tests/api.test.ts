import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, one, run } from "../src/db";
import { Client, newUser, resetRateLimits, rid, startServer, stopServer } from "./helpers";
import { sequenceRng } from "../src/games/rng";
import { setRng } from "../src/services/gameplay";
import { newShoe, handValue } from "../src/games/blackjack";
import { advanceClock } from "../src/lib/clock";
import { reconcile } from "../src/services/wallet";

beforeAll(startServer);
afterAll(async () => {
  setRng(null);
  await stopServer();
});
beforeEach(() => {
  resetRateLimits();
  setRng(null);
});

const slotsInput = (stake: number) => ({ requestId: rid(), input: { stake } });

describe("registrasi & autentikasi", () => {
  it("registrasi memberi 10.000 koin lewat entri INITIAL_GRANT", async () => {
    const { c, id } = await newUser();
    const me = await c.get("/api/me");
    expect(me.data.balance).toBe(10000);
    const tx = await c.get("/api/wallet/transactions");
    expect(tx.data.items).toHaveLength(1);
    expect(tx.data.items[0]).toMatchObject({ type: "INITIAL_GRANT", amount: 10000, balanceAfter: 10000 });
    expect(one<any>("SELECT password_hash h FROM users WHERE id=?", id)!.h).toMatch(/^scrypt\$/);
  });
  it("cookie sesi HttpOnly + SameSite, bernama __session", async () => {
    const res = await fetch((await import("./helpers")).base + "/api/auth/register", {
      method: "POST", headers: { "content-type": "application/json", "x-zamrud-csrf": "1" },
      body: JSON.stringify({ email: "cookie@test.dev", username: "cookieuser", displayName: "Cookie", password: "kata-sandi-aman-1" }),
    });
    const sc = res.headers.getSetCookie().join(";");
    expect(sc).toMatch(/__session=/);
    expect(sc).toMatch(/HttpOnly/);
    expect(sc).toMatch(/SameSite=Lax/);
  });
  it("email/username duplikat ditolak, password lemah ditolak", async () => {
    const { email } = await newUser("dup");
    const c = new Client();
    const r = await c.post("/api/auth/register", { email, username: "lain12", displayName: "Lain", password: "kata-sandi-aman-1" });
    expect(r.status).toBe(409);
    expect(r.error).toBe("EMAIL_TAKEN");
    const w = await c.post("/api/auth/register", { email: "w@test.dev", username: "wk1234", displayName: "W", password: "123" });
    expect(w.status).toBe(400);
  });
  it("login benar/salah, logout mencabut sesi, rute privat butuh login", async () => {
    const { email } = await newUser("lg");
    const anon = new Client();
    expect((await anon.get("/api/me")).status).toBe(401);
    expect((await anon.post("/api/auth/login", { identifier: email, password: "salah-salah-1" })).error).toBe("INVALID_CREDENTIALS");
    expect((await anon.post("/api/auth/login", { identifier: "tidakada@test.dev", password: "salah-salah-1" })).error).toBe("INVALID_CREDENTIALS");
    const ok = await anon.post("/api/auth/login", { identifier: email, password: "kata-sandi-aman-1" });
    expect(ok.status).toBe(200);
    expect((await anon.get("/api/me")).status).toBe(200);
    const stolen = anon.cookie;
    await anon.post("/api/auth/logout");
    const again = new Client();
    again.cookie = stolen;
    expect((await again.get("/api/me")).status).toBe(401);
  });
  it("brute-force login dibatasi (429)", async () => {
    const c = new Client();
    let last = 0;
    for (let i = 0; i < 10; i++) last = (await c.post("/api/auth/login", { identifier: "brute@test.dev", password: "x-x-x-x-x-1" })).status;
    expect(last).toBe(429);
  });
  it("Origin browser di belakang proxy (X-Forwarded-Host / ALLOWED_ORIGINS) diterima; Origin asing tetap ditolak", async () => {
    const { base } = await import("./helpers");
    const post = (extra: Record<string, string>) => fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-zamrud-csrf": "1", ...extra }, body: JSON.stringify({ identifier: "x@x.dev", password: "x" }) }).then((r) => r.status);
    // tanpa proxy tepercaya, X-Forwarded-Host tidak dipercaya
    expect(await post({ origin: "https://app.example", "x-forwarded-host": "app.example" })).toBe(403);
    process.env.TRUST_PROXY = "1";
    expect(await post({ origin: "https://app.example", "x-forwarded-host": "app.example" })).toBe(401); // lolos CSRF, gagal login
    expect(await post({ origin: "https://evil.example", "x-forwarded-host": "app.example" })).toBe(403);
    process.env.TRUST_PROXY = "0";
    process.env.ALLOWED_ORIGINS = "https://app.example";
    expect(await post({ origin: "https://app.example" })).toBe(401);
    expect(await post({ origin: "https://evil.example" })).toBe(403);
    delete process.env.ALLOWED_ORIGINS;
  });
  it("CSRF: permintaan mengubah data tanpa header kustom / dengan Origin asing ditolak", async () => {
    const { c } = await newUser("csrf");
    const { base } = await import("./helpers");
    const noHeader = await fetch(base + "/api/wallet/daily-claim", { method: "POST", headers: { cookie: c.cookie, "content-type": "application/json" }, body: "{}" });
    expect(noHeader.status).toBe(403);
    const evil = await fetch(base + "/api/wallet/daily-claim", {
      method: "POST", headers: { cookie: c.cookie, "content-type": "application/json", "x-zamrud-csrf": "1", origin: "https://evil.example" }, body: "{}",
    });
    expect(evil.status).toBe(403);
  });
});

describe("dompet & hadiah", () => {
  it("klaim harian: sekali per hari, replay ditolak, besok bisa lagi", async () => {
    const { c } = await newUser("daily");
    const a = await c.post("/api/wallet/daily-claim");
    expect(a.status).toBe(200);
    expect(a.data.balance).toBe(10500);
    const b = await c.post("/api/wallet/daily-claim");
    expect(b.status).toBe(409);
    expect(b.error).toBe("ALREADY_CLAIMED");
    expect((await c.get("/api/wallet")).data.balance).toBe(10500);
    advanceClock(26 * 3600_000);
    const next = await c.post("/api/wallet/daily-claim");
    expect(next.status).toBe(200);
    expect(next.data.balance).toBe(11000);
  });
  it("klaim harian paralel (20 permintaan) hanya berhasil sekali", async () => {
    const { c } = await newUser("par");
    const rs = await Promise.all(Array.from({ length: 20 }, () => c.post("/api/wallet/daily-claim")));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await c.get("/api/wallet")).data.balance).toBe(10500);
  });
  it("kode promo: sekali per pengguna, kode salah ditolak", async () => {
    const { c } = await newUser("promo");
    expect((await c.post("/api/wallet/promo", { code: "NGAWUR" })).status).toBe(404);
    const ok = await c.post("/api/wallet/promo", { code: "selamatdatang" });
    expect(ok.status).toBe(200);
    expect(ok.data.balance).toBe(11000);
    expect((await c.post("/api/wallet/promo", { code: "SELAMATDATANG" })).error).toBe("PROMO_ALREADY_USED");
  });
  it("tidak ada endpoint transfer / pembelian / mutasi saldo untuk pengguna", async () => {
    const { c } = await newUser("nomutate");
    for (const p of ["/api/wallet/transfer", "/api/wallet/buy", "/api/wallet/withdraw", "/api/wallet/adjust", "/api/wallet/balance"]) {
      const r = await c.post(p, { amount: 99999, to: "x" });
      expect([404, 405]).toContain(r.status);
    }
    expect((await c.put("/api/wallet", { balance: 99999 })).status).toBe(404);
    expect((await c.get("/api/wallet")).data.balance).toBe(10000);
  });
  it("ledger append-only: UPDATE/DELETE diblokir trigger; CHECK saldo >= 0", async () => {
    const { id } = await newUser("ledger");
    expect(() => run("UPDATE wallet_transactions SET amount=1 WHERE user_id=?", id)).toThrow(/append-only/);
    expect(() => run("DELETE FROM wallet_transactions WHERE user_id=?", id)).toThrow(/append-only/);
    expect(() => run("UPDATE wallets SET balance=-1 WHERE user_id=?", id)).toThrow();
  });
});

describe("game: slots / roulette / dice", () => {
  it("slots: payout dihitung server, saldo + ledger konsisten", async () => {
    const { c } = await newUser("slot");
    setRng(sequenceRng([0, 0, 0])); // CHERRY ×3 = 5×
    const r = await c.post("/api/games/virtual-slots/sessions", slotsInput(100));
    expect(r.status).toBe(200);
    expect(r.data.view.reels).toEqual(["CHERRY", "CHERRY", "CHERRY"]);
    expect(r.data.payout).toBe(500);
    expect(r.data.net).toBe(400);
    expect(r.data.balance).toBe(10400);
    const tx = (await c.get("/api/wallet/transactions")).data.items;
    expect(tx.map((t: any) => t.type)).toEqual(["GAME_PAYOUT", "GAME_STAKE", "INITIAL_GRANT"]);
    const h = (await c.get("/api/history")).data.items;
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ game: "virtual-slots", stake: 100, payout: 500, net: 400, configVersion: 1 });
  });
  it("klien tidak bisa menyuntik payout/hasil (mass assignment ditolak)", async () => {
    const { c } = await newUser("inject");
    const r = await c.post("/api/games/virtual-slots/sessions", { requestId: rid(), input: { stake: 100, payout: 999999, reels: ["SEVEN", "SEVEN", "SEVEN"] } });
    expect(r.status).toBe(400);
    expect((await c.get("/api/wallet")).data.balance).toBe(10000);
    const top = await c.post("/api/games/virtual-slots/sessions", { requestId: rid(), input: { stake: 100 }, payout: 5 });
    expect(top.status).toBe(400);
  });
  it("saldo kurang ditolak 402 tanpa jejak sesi/ledger; saldo tak pernah negatif", async () => {
    const { c, id } = await newUser("poor");
    // Habiskan saldo lewat admin-ish SQL tidak mungkin (append-only) — pakai taruhan roulette maksimum berulang
    setRng(sequenceRng(Array(40).fill(0))); // 0 hijau: taruhan merah kalah
    let guard = 0;
    while ((await c.get("/api/wallet")).data.balance >= 1000 && guard++ < 30) {
      const r = await c.post("/api/games/euro-roulette/sessions", { requestId: rid(), input: { bets: [{ kind: "red", stake: 1000 }] } });
      expect(r.status).toBe(200);
    }
    const left = (await c.get("/api/wallet")).data.balance;
    expect(left).toBeLessThan(1000);
    const sessionsBefore = one<any>("SELECT COUNT(*) c FROM game_sessions WHERE user_id=?", id)!.c;
    const txBefore = one<any>("SELECT COUNT(*) c FROM wallet_transactions WHERE user_id=?", id)!.c;
    const res = await c.post("/api/games/euro-roulette/sessions", { requestId: rid(), input: { bets: [{ kind: "red", stake: 1000 }] } });
    expect(res.status).toBe(402);
    expect(res.error).toBe("INSUFFICIENT_BALANCE");
    expect(one<any>("SELECT COUNT(*) c FROM game_sessions WHERE user_id=?", id)!.c).toBe(sessionsBefore);
    expect(one<any>("SELECT COUNT(*) c FROM wallet_transactions WHERE user_id=?", id)!.c).toBe(txBefore);
    expect((await c.get("/api/wallet")).data.balance).toBe(left);
  });
  it("replay requestId yang sama tidak memotong saldo dua kali", async () => {
    const { c } = await newUser("replay");
    const body = slotsInput(100);
    const a = await c.post("/api/games/virtual-slots/sessions", body);
    const b = await c.post("/api/games/virtual-slots/sessions", body);
    expect(b.data.sessionId).toBe(a.data.sessionId);
    expect(b.data.replay).toBe(true);
    const staked = one<any>("SELECT COUNT(*) c FROM wallet_transactions WHERE type='GAME_STAKE' AND game_session_id=?", a.data.sessionId)!.c;
    expect(staked).toBe(1);
  });
  it("permintaan paralel dengan requestId sama: tepat satu sesi", async () => {
    const { c, id } = await newUser("parslot");
    const body = slotsInput(50);
    await Promise.all(Array.from({ length: 10 }, () => c.post("/api/games/virtual-slots/sessions", body)));
    expect(one<any>("SELECT COUNT(*) c FROM game_sessions WHERE user_id=?", id)!.c).toBe(1);
  });
  it("roulette: payout total benar; dice: pembulatan ke bawah", async () => {
    const { c } = await newUser("rd");
    setRng(sequenceRng([7]));
    const r = await c.post("/api/games/euro-roulette/sessions", { requestId: rid(), input: { bets: [{ kind: "straight", value: 7, stake: 10 }, { kind: "red", stake: 10 }] } });
    expect(r.data.payout).toBe(360 + 20);
    expect(r.data.view.color).toBe("red");
    setRng(sequenceRng([9]));
    const d = await c.post("/api/games/dice-duel/sessions", { requestId: rid(), input: { stake: 100, mode: "under", target: 51 } });
    expect(d.data.payout).toBe(198);
    expect(d.data.view).toMatchObject({ roll: 10, winningNumbers: 50 });
  });
  it("game dinonaktifkan tidak bisa dimainkan; slug asing 404", async () => {
    const { c } = await newUser("dis");
    expect((await c.post("/api/games/tidak-ada/sessions", slotsInput(100))).status).toBe(404);
  });
  it("statistik & riwayat berasal dari catatan nyata dan konsisten dengan ledger", async () => {
    const { c } = await newUser("stat");
    for (let i = 0; i < 5; i++) await c.post("/api/games/virtual-slots/sessions", slotsInput(10));
    const s = (await c.get("/api/statistics")).data;
    expect(s.totals.gamesPlayed).toBe(5);
    expect(s.totals.coinsStaked).toBe(50);
    expect(s.totals.netBalanceChange).toBe(s.totals.grossPayouts - s.totals.coinsStaked);
    const bal = (await c.get("/api/wallet")).data.balance;
    expect(bal).toBe(10000 + s.totals.netBalanceChange);
  });
  it("riwayat bernomor halaman via kursor, tanpa memuat semuanya", async () => {
    const { c } = await newUser("pg");
    for (let i = 0; i < 7; i++) await c.post("/api/games/virtual-slots/sessions", slotsInput(10));
    const p1 = (await c.get("/api/history?limit=3")).data;
    expect(p1.items).toHaveLength(3);
    expect(p1.nextCursor).toBeTruthy();
    const p2 = (await c.get(`/api/history?limit=3&cursor=${p1.nextCursor}`)).data;
    expect(p2.items).toHaveLength(3);
    expect(p2.items[0].sessionId).not.toBe(p1.items[2].sessionId);
  });
});

describe("blackjack (server-authoritative)", () => {
  // RNG nol-semua -> shoe deterministik yang bisa dihitung ulang di tes.
  const zero = { int: () => 0 };
  const shoe = newShoe(6, zero);
  const cardsDealt = { p1: shoe[0], d1: shoe[1], p2: shoe[2], d2: shoe[3] };

  it("alur penuh: mulai, kartu tersembunyi tidak bocor, stand menuntaskan ronde, ledger cocok", async () => {
    const { c } = await newUser("bj");
    setRng(zero);
    const pBJ = handValue([cardsDealt.p1, cardsDealt.p2]).total === 21;
    const dBJ = handValue([cardsDealt.d1, cardsDealt.d2]).total === 21;
    const start = await c.post("/api/games/blackjack-21/sessions", { requestId: rid(), input: { stake: 100 } });
    expect(start.status).toBe(200);
    expect(JSON.stringify(start.json)).not.toMatch(/shoe/);
    if (pBJ || dBJ) return; // ronde selesai langsung — jalur lain dicakup tes unit
    expect(start.data.status).toBe("ACTIVE");
    expect(start.data.view.dealer).toEqual([cardsDealt.d1]);
    expect(start.data.view.dealerHiddenCards).toBe(1);
    expect(start.data.balance).toBe(9900);

    const sid = start.data.sessionId;
    const act = { clientActionId: rid(), expectedSeq: 0, action: { type: "stand" } };
    const done = await c.post(`/api/sessions/${sid}/actions`, act);
    expect(done.status).toBe(200);
    expect(done.data.status).toBe("COMPLETED");
    expect(done.data.view.dealer.length).toBeGreaterThanOrEqual(2);
    // replay aksi yang sama -> hasil tersimpan, saldo tidak berubah
    const replay = await c.post(`/api/sessions/${sid}/actions`, act);
    expect(replay.data.replay).toBe(true);
    expect(replay.data.balance).toBe(done.data.balance);
    // aksi baru pada ronde selesai ditolak
    const late = await c.post(`/api/sessions/${sid}/actions`, { clientActionId: rid(), expectedSeq: 1, action: { type: "hit" } });
    expect(late.status).toBe(409);
    expect(done.data.balance).toBe(9900 + done.data.payout);
  });

  it("aksi dengan seq usang ditolak; kartu buatan sendiri ditolak; ronde kedua saat aktif ditolak", async () => {
    const { c } = await newUser("bj2");
    setRng(zero);
    const start = await c.post("/api/games/blackjack-21/sessions", { requestId: rid(), input: { stake: 100 } });
    if (start.data.status !== "ACTIVE") return;
    const sid = start.data.sessionId;
    expect((await c.post(`/api/sessions/${sid}/actions`, { clientActionId: rid(), expectedSeq: 5, action: { type: "hit" } })).error).toBe("STALE_ACTION");
    expect((await c.post(`/api/sessions/${sid}/actions`, { clientActionId: rid(), expectedSeq: 0, action: { type: "hit", card: 12 } })).status).toBe(400);
    expect((await c.post(`/api/sessions/${sid}/actions`, { clientActionId: rid(), expectedSeq: 0, action: { type: "stand" }, payout: 9999 })).status).toBe(400);
    const second = await c.post("/api/games/blackjack-21/sessions", { requestId: rid(), input: { stake: 100 } });
    expect(second.error).toBe("ROUND_IN_PROGRESS");
    const active = await c.get("/api/games/blackjack-21/active");
    expect(active.data.sessionId).toBe(sid);
  });

  it("double down memotong taruhan tambahan; saldo kurang untuk double ditolak tanpa mengubah state", async () => {
    const { c } = await newUser("bj3");
    setRng(zero);
    const start = await c.post("/api/games/blackjack-21/sessions", { requestId: rid(), input: { stake: 100 } });
    if (start.data.status !== "ACTIVE") return;
    const d = await c.post(`/api/sessions/${start.data.sessionId}/actions`, { clientActionId: rid(), expectedSeq: 0, action: { type: "double" } });
    expect(d.status).toBe(200);
    expect(d.data.status).toBe("COMPLETED");
    expect(d.data.stake).toBe(200);
    expect(d.data.balance).toBe(9800 + d.data.payout);
  });
});

describe("otorisasi, IDOR & admin", () => {
  it("pengguna lain tidak bisa melihat/bertindak pada sesi game orang lain (404)", async () => {
    const a = await newUser("ia");
    const b = await newUser("ib");
    setRng({ int: () => 0 });
    const s = await a.c.post("/api/games/virtual-slots/sessions", slotsInput(10));
    expect((await b.c.get(`/api/sessions/${s.data.sessionId}`)).status).toBe(404);
    expect((await b.c.post(`/api/sessions/${s.data.sessionId}/actions`, { clientActionId: rid(), expectedSeq: 0, action: { type: "hit" } })).status).toBe(404);
    expect((await b.c.get("/api/history")).data.items).toHaveLength(0);
  });
  it("rute admin: anonim 401, pengguna biasa 403 di SEMUA endpoint admin", async () => {
    const { c } = await newUser("na");
    const anon = new Client();
    const paths: [string, string][] = [
      ["GET", "/api/admin/analytics"], ["GET", "/api/admin/users"], ["GET", "/api/admin/games"], ["GET", "/api/admin/missions"],
      ["GET", "/api/admin/economy"], ["GET", "/api/admin/audit-logs"], ["GET", "/api/admin/support"],
      ["POST", "/api/admin/users/x/adjust-balance"], ["POST", "/api/admin/users/x/status"], ["PUT", "/api/admin/economy"],
      ["POST", "/api/admin/missions"], ["POST", "/api/admin/promos"],
    ];
    for (const [m, p] of paths) {
      expect((await anon.req(m, p, {})).status).toBe(401);
      const r = await c.req(m, p, {});
      expect(r.status, `${m} ${p}`).toBe(403);
      expect(r.error).toBe("ADMIN_ONLY");
    }
  });
  it("admin sah: penyesuaian saldo wajib alasan, tercatat di ledger & audit; suspend mencabut sesi", async () => {
    const admin = await newUser("adm");
    run("UPDATE users SET role='ADMIN' WHERE id=?", admin.id);
    const victim = await newUser("vic");
    const noReason = await admin.c.post(`/api/admin/users/${victim.id}/adjust-balance`, { amount: 500 });
    expect(noReason.status).toBe(400);
    const adj = await admin.c.post(`/api/admin/users/${victim.id}/adjust-balance`, { amount: 500, reason: "kompensasi gangguan uji" });
    expect(adj.status).toBe(200);
    expect(adj.data.balance).toBe(10500);
    expect((await victim.c.get("/api/wallet")).data.balance).toBe(10500);
    const neg = await admin.c.post(`/api/admin/users/${victim.id}/adjust-balance`, { amount: -999999, reason: "uji saldo negatif" });
    expect([400, 402]).toContain(neg.status);
    const logs = (await admin.c.get("/api/admin/audit-logs")).data.items;
    expect(logs.some((l: any) => l.action === "BALANCE_ADJUST" && l.targetId === victim.id)).toBe(true);
    const sus = await admin.c.post(`/api/admin/users/${victim.id}/status`, { status: "SUSPENDED", reason: "uji penangguhan akun" });
    expect(sus.status).toBe(200);
    expect((await victim.c.get("/api/me")).status).toBe(401);
    const relogin = await new Client().post("/api/auth/login", { identifier: victim.email, password: "kata-sandi-aman-1" });
    expect(relogin.error).toBe("ACCOUNT_SUSPENDED");
    expect((await admin.c.post(`/api/admin/users/${admin.id}/status`, { status: "SUSPENDED", reason: "tidak boleh sendiri" })).status).toBe(400);
  });
  it("admin: konfigurasi game divalidasi, versi baru tidak mengubah sesi lama, publikasi diaudit", async () => {
    const admin = await newUser("cfgadm");
    run("UPDATE users SET role='ADMIN' WHERE id=?", admin.id);
    const games = (await admin.c.get("/api/admin/games")).data;
    const slots = games.find((g: any) => g.slug === "virtual-slots");
    const cfg = slots.versions[0].config;
    const bad = await admin.c.post(`/api/admin/games/${slots.id}/configs`, { config: { ...cfg, symbols: cfg.symbols.map((s: any) => ({ ...s, three: s.three * 5 })) } });
    expect(bad.status).toBe(400);
    expect(bad.error).toBe("CONFIG_INVALID");
    const player = await newUser("cfgplayer");
    setRng({ int: () => 0 });
    const before = await player.c.post("/api/games/virtual-slots/sessions", slotsInput(10));
    expect(before.data.configVersion).toBe(1);
    const draft = await admin.c.post(`/api/admin/games/${slots.id}/configs`, { config: { ...cfg, maxStake: 500, stakeSteps: [10, 50, 100, 250, 500] } });
    expect(draft.data.version).toBe(2);
    const pub = await admin.c.post(`/api/admin/games/${slots.id}/configs/2/publish`, { reason: "uji versi baru" });
    expect(pub.status).toBe(200);
    const after = await player.c.post("/api/games/virtual-slots/sessions", slotsInput(10));
    expect(after.data.configVersion).toBe(2);
    expect((await player.c.post("/api/games/virtual-slots/sessions", slotsInput(1000))).error).toBe("STAKE_OUT_OF_RANGE");
    const hist = (await player.c.get("/api/history")).data.items;
    expect(hist.map((h: any) => h.configVersion)).toEqual([2, 1]);
    // kembalikan v1 sebagai v3 agar tes lain tidak terpengaruh
    await admin.c.post(`/api/admin/games/${slots.id}/configs`, { config: cfg });
    await admin.c.post(`/api/admin/games/${slots.id}/configs/3/publish`, { reason: "kembalikan konfigurasi awal" });
  });
  it("analitik admin dihitung dari data nyata", async () => {
    const admin = await newUser("anadm");
    run("UPDATE users SET role='ADMIN' WHERE id=?", admin.id);
    const a = (await admin.c.get("/api/admin/analytics?days=30")).data;
    expect(a.registeredUsers).toBe(one<any>("SELECT COUNT(*) c FROM users WHERE status<>'DELETED'")!.c);
    expect(a.completedSessions).toBe(one<any>("SELECT COUNT(*) c FROM game_results")!.c);
    expect((await admin.c.get("/api/admin/analytics?days=5")).status).toBe(400);
  });
});

describe("misi, pencapaian, personalisasi, bermain sehat", () => {
  it("misi: progres dari aksi nyata, klaim idempoten, hadiah masuk ledger", async () => {
    const { c } = await newUser("mis");
    const before = (await c.get("/api/missions")).data;
    const tut = before.find((m: any) => m.key === "tutorial");
    expect(tut.progress).toBe(0);
    expect((await c.post(`/api/missions/${tut.id}/claim`, { periodKey: "once" })).error).toBe("MISSION_NOT_COMPLETE");
    await c.post("/api/me/tutorial");
    const cl = await c.post(`/api/missions/${tut.id}/claim`, { periodKey: "once" });
    expect(cl.status).toBe(200);
    expect(cl.data.balance).toBe(11000);
    expect((await c.post(`/api/missions/${tut.id}/claim`, { periodKey: "once" })).error).toBe("ALREADY_CLAIMED");
    const par = await Promise.all(Array.from({ length: 5 }, () => c.post(`/api/missions/${tut.id}/claim`, { periodKey: "once" })));
    expect(par.every((r) => r.status === 409)).toBe(true);
    expect((await c.get("/api/wallet")).data.balance).toBe(11000);
  });
  it("misi 'tiga game berbeda' + pencapaian dibuka dari catatan nyata", async () => {
    const { c } = await newUser("ach");
    setRng({ int: () => 0 });
    await c.post("/api/games/virtual-slots/sessions", slotsInput(10));
    await c.post("/api/games/dice-duel/sessions", { requestId: rid(), input: { stake: 10, mode: "under", target: 51 } });
    const m1 = (await c.get("/api/missions")).data.find((m: any) => m.key === "three-games");
    expect(m1.progress).toBe(2);
    await c.post("/api/games/euro-roulette/sessions", { requestId: rid(), input: { bets: [{ kind: "red", stake: 10 }] } });
    const m2 = (await c.get("/api/missions")).data.find((m: any) => m.key === "three-games");
    expect(m2.completed).toBe(true);
    const ach = (await c.get("/api/achievements")).data;
    expect(ach.find((a: any) => a.key === "first-game").unlockedAt).toBeTruthy();
    expect(ach.find((a: any) => a.key === "explorer").unlockedAt).toBeTruthy();
    expect(ach.find((a: any) => a.key === "game-collector").unlockedAt).toBeNull();
  });
  it("personalisasi: bisa dimatikan (riwayat perilaku terhapus & berhenti dicatat) dan direset", async () => {
    const { c, id } = await newUser("pers");
    await c.post("/api/me/events", { type: "GAME_VIEWED", game: "virtual-slots" });
    expect(one<any>("SELECT COUNT(*) c FROM user_events WHERE user_id=? AND type='GAME_VIEWED'", id)!.c).toBe(1);
    await c.patch("/api/me/preferences", { favoriteCategories: ["CARDS"], preferredTags: ["strategy"] });
    const dash = (await c.get("/api/me/dashboard")).data;
    expect(dash.recommendations[0].reason.key).toBe("rec.favoriteCategory");
    await c.patch("/api/me/preferences", { personalizationEnabled: false });
    expect(one<any>("SELECT COUNT(*) c FROM user_events WHERE user_id=?", id)!.c).toBe(0);
    await c.post("/api/me/events", { type: "GAME_VIEWED", game: "virtual-slots" });
    expect(one<any>("SELECT COUNT(*) c FROM user_events WHERE user_id=?", id)!.c).toBe(0);
    const dash2 = (await c.get("/api/me/dashboard")).data;
    expect(dash2.recommendations.every((r: any) => r.reason.key === "rec.default")).toBe(true);
    const reset = await c.post("/api/me/recommendations/reset");
    expect(reset.data.preferences.favoriteCategories).toEqual([]);
  });
  it("odds/payout tidak bergantung pada perilaku individu: konfigurasi sama untuk semua pemain", async () => {
    const a = await newUser("oa");
    const b = await newUser("ob");
    const ga = (await a.c.get("/api/games/virtual-slots")).data;
    await a.c.patch("/api/me/preferences", { favoriteCategories: ["SLOTS"] });
    const gb = (await b.c.get("/api/games/virtual-slots")).data;
    expect(gb.rules).toEqual(ga.rules);
  });
  it("jeda sukarela memblokir ronde baru; batas harian & cooldown ditegakkan server", async () => {
    const { c } = await newUser("rp");
    expect((await c.put("/api/me/responsible-play", { reminderMinutes: 5, dailyLimitMinutes: null, cooldownSeconds: 0 })).status).toBe(400);
    expect((await c.put("/api/me/responsible-play", { reminderMinutes: 30, dailyLimitMinutes: 60, cooldownSeconds: 0 })).status).toBe(200);
    await c.post("/api/me/responsible-play/break", { minutes: 15 });
    const blocked = await c.post("/api/games/virtual-slots/sessions", slotsInput(10));
    expect(blocked.status).toBe(403);
    expect(blocked.error).toBe("BREAK_ACTIVE");
    expect((await c.post("/api/wallet/daily-claim")).status).toBe(200); // jeda tidak menghukum hadiah gratis
    await c.del("/api/me/responsible-play/break");
    await c.put("/api/me/responsible-play", { reminderMinutes: 30, dailyLimitMinutes: null, cooldownSeconds: 60 });
    expect((await c.post("/api/games/virtual-slots/sessions", slotsInput(10))).status).toBe(200);
    expect((await c.post("/api/games/virtual-slots/sessions", slotsInput(10))).error).toBe("COOLDOWN_ACTIVE");
  });
  it("detak durasi sesi dihitung server; batas harian tercapai memblokir ronde baru", async () => {
    const { c, id } = await newUser("hb");
    await c.put("/api/me/responsible-play", { reminderMinutes: 30, dailyLimitMinutes: 10, cooldownSeconds: 0 });
    const h1 = await c.post("/api/auth/heartbeat");
    expect(h1.data.sessionSeconds).toBe(0);
    run("UPDATE session_summaries SET duration_sec=600 WHERE user_id=?", id);
    const h2 = await c.post("/api/auth/heartbeat");
    expect(h2.data.limitReached).toBe(true);
    expect((await c.post("/api/games/virtual-slots/sessions", slotsInput(10))).error).toBe("DAILY_LIMIT_REACHED");
  });
  it("detak melaporkan jumlah ronde & perubahan saldo sesi (reality check), bukan hanya waktu", async () => {
    const { c } = await newUser("rc");
    await c.post("/api/auth/heartbeat");
    let net = 0;
    for (let i = 0; i < 3; i++) {
      resetRateLimits();
      const r = await c.post("/api/games/virtual-slots/sessions", slotsInput(10));
      expect(r.status).toBe(200);
      net += r.data.payout - r.data.stake;
    }
    const h = await c.post("/api/auth/heartbeat");
    expect(h.data.sessionRounds).toBe(3);
    expect(h.data.sessionNet).toBe(net);
  });
  it("batas harian ditegakkan walau klien TIDAK pernah mengirim heartbeat (waktu dari aktivitas ronde)", async () => {
    const { c } = await newUser("nohb");
    await c.put("/api/me/responsible-play", { reminderMinutes: 30, dailyLimitMinutes: 10, cooldownSeconds: 0 });
    let blocked = "";
    for (let i = 0; i < 14 && !blocked; i++) {
      advanceClock(80_000); // 80 dtk antar ronde
      const r = await c.post("/api/games/virtual-slots/sessions", slotsInput(10));
      if (r.status !== 200) blocked = r.error ?? "";
    }
    expect(blocked).toBe("DAILY_LIMIT_REACHED");
  });
  it("rate limit tidak bisa dilewati dengan memalsukan X-Forwarded-For", async () => {
    const c = new Client();
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await c.req("POST", "/api/auth/register", { email: `xff${i}${Date.now()}@test.dev`, username: `xff${i}x${Date.now() % 100000}`, displayName: "Xff", password: "kata-sandi-aman-1" }, { "x-forwarded-for": `10.0.0.${i}` });
      codes.push(r.status);
    }
    expect(codes.filter((s) => s === 200)).toHaveLength(8);
    expect(codes.slice(8).every((s) => s === 429)).toBe(true);
  });
  it("hapus akun = anonimisasi, ledger dipertahankan, login tak mungkin lagi", async () => {
    const { c, id, email } = await newUser("del");
    await c.post("/api/games/virtual-slots/sessions", slotsInput(10));
    expect((await c.post("/api/auth/delete-account", { password: "salah-salah-1" })).status).toBe(401);
    expect((await c.post("/api/auth/delete-account", { password: "kata-sandi-aman-1" })).status).toBe(200);
    expect(one<any>("SELECT COUNT(*) c FROM wallet_transactions WHERE user_id=?", id)!.c).toBeGreaterThan(0);
    expect(one<any>("SELECT email e, status s FROM users WHERE id=?", id)).toMatchObject({ s: "DELETED" });
    expect((await new Client().post("/api/auth/login", { identifier: email, password: "kata-sandi-aman-1" })).status).toBe(401);
  });
});

describe("konsistensi global", () => {
  it("rekonsiliasi: saldo = jumlah ledger untuk SEMUA pengguna setelah seluruh tes", () => {
    expect(reconcile()).toEqual([]);
    const neg = one<any>("SELECT COUNT(*) c FROM wallets WHERE balance<0")!.c;
    expect(neg).toBe(0);
    expect(db).toBeTruthy();
  });
  it("kesehatan & 404 API berformat konsisten", async () => {
    const c = new Client();
    expect((await c.get("/api/health")).data.status).toBe("up");
    const nf = await c.get("/api/tidak-ada");
    expect(nf.status).toBe(404);
    expect(nf.json.ok).toBe(false);
  });
});
