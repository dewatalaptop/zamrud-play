import { describe, expect, it } from "vitest";
import { sequenceRng } from "../src/games/rng";
import { PAYLINES, evalGrid, evalLine, slots5DefaultConfig as cfg, slots5Engine, slots5Payout, slots5Rtp } from "../src/games/slots5";

const C = "CHERRY", L = "LEMON", B = "BELL", W = "WILD", S = "SCATTER";
const fill = (id: string) => Array.from({ length: 5 }, () => [id, id, id]);

describe("slots 5×3", () => {
  it("RTP eksak ≤ 100% dan wajar", () => {
    const r = slots5Rtp(cfg);
    expect(r.percent).toBe(95.3);
    expect(r.percent).toBeLessThanOrEqual(100);
    expect(r.lines + r.scatter).toBeCloseTo(r.percent, 1);
  });
  it("garis bayar: 3/4/5 berurutan dari kiri; putus bila ada simbol lain", () => {
    expect(evalLine(cfg, [C, C, C, L, L])).toMatchObject({ symbol: C, count: 3, mult: 5 });
    expect(evalLine(cfg, [C, C, C, C, L])).toMatchObject({ count: 4, mult: 15 });
    expect(evalLine(cfg, [C, C, C, C, C])).toMatchObject({ count: 5, mult: 50 });
    expect(evalLine(cfg, [C, C, L, C, C]).mult).toBe(0);
    expect(evalLine(cfg, [L, C, C, C, C]).mult).toBe(0); // harus mulai dari gulungan 1
  });
  it("WILD menggantikan simbol biasa tetapi tidak SCATTER", () => {
    expect(evalLine(cfg, [W, C, C, L, L])).toMatchObject({ symbol: C, count: 3, mult: 5 });
    expect(evalLine(cfg, [C, W, C, C, L])).toMatchObject({ count: 4, mult: 15 });
    expect(evalLine(cfg, [W, W, L, L, L]).mult).toBe(60);
    expect(evalLine(cfg, [W, W, W, B, B]).mult).toBe(100); // deretan WILD murni lebih baik dari BELL 3 (10)
    expect(evalLine(cfg, [W, W, W, W, W]).mult).toBe(1500);
    expect(evalLine(cfg, [C, C, S, C, C]).mult).toBe(0);
    expect(evalLine(cfg, [W, W, S, C, C]).mult).toBe(0);
  });
  it("SCATTER membayar di mana saja sebagai kelipatan taruhan total, tanpa garis", () => {
    const g = [[S, L, C], [B, L, B], [C, S, L], [L, C, B], [S, B, C]]; // 3 scatter, tak ada garis
    const e = evalGrid(cfg, g);
    expect(e.wins).toEqual([]);
    expect(e.scatter.count).toBe(3);
    expect(slots5Payout(cfg, 100, g)).toBe(200);
    expect(e.scatter.cells).toHaveLength(3);
  });
  it("dua SCATTER tidak membayar dan tidak disorot", () => {
    const g = [[S, L, C], [B, L, B], [C, S, L], [L, C, B], [L, B, C]];
    const e = evalGrid(cfg, g);
    expect(e.scatter).toMatchObject({ count: 2, mult: 0, cells: [] });
    expect(slots5Payout(cfg, 100, g)).toBe(0);
  });
  it("seluruh layar satu simbol membayar semua 10 garis; pembayaran bilangan bulat", () => {
    const r = slots5Engine.start(cfg, { stake: 100 }, sequenceRng(Array(15).fill(0)));
    expect((r.state as any).grid).toEqual(fill(C));
    expect((r.state as any).wins).toHaveLength(PAYLINES.length);
    expect(r.payout).toBe(10 * 50 * 10 + 0); // 10 garis × 50× × taruhan per garis (10)
    expect(Number.isInteger(r.payout)).toBe(true);
    expect(r.stake).toBe(100);
  });
  it("urutan undian: gulungan demi gulungan, tiga baris", () => {
    // 0 -> CHERRY, 26 -> LEMON, 48 -> BELL
    const r = slots5Engine.start(cfg, { stake: 10 }, sequenceRng([0, 26, 48, 0, 26, 48, 0, 26, 48, 0, 26, 48, 0, 26, 48]));
    expect((r.state as any).grid[0]).toEqual([C, L, B]);
    expect((r.state as any).grid[4]).toEqual([C, L, B]);
  });
  it("taruhan harus kelipatan jumlah garis dan dalam batas; field tak dikenal ditolak", () => {
    expect(() => slots5Engine.parseStart({ stake: 15 }, cfg)).toThrow();
    expect(() => slots5Engine.parseStart({ stake: 5 }, cfg)).toThrow();
    expect(() => slots5Engine.parseStart({ stake: 10, payout: 9 }, cfg)).toThrow();
    expect(slots5Engine.parseStart({ stake: 250 }, cfg)).toEqual({ stake: 250 });
  });
  it("validateConfig menolak tanpa WILD/SCATTER, taruhan bukan kelipatan garis, dan RTP > 100%", () => {
    expect(slots5Engine.validateConfig(cfg).ok).toBe(true);
    expect(slots5Engine.validateConfig({ ...cfg, symbols: cfg.symbols.filter((s) => s.id !== "WILD") }).ok).toBe(false);
    expect(slots5Engine.validateConfig({ ...cfg, stakeSteps: [10, 55] }).ok).toBe(false);
    expect(slots5Engine.validateConfig({ ...cfg, scatterPays: [5000, 5000, 5000] }).ok).toBe(false);
    expect(slots5Engine.validateConfig({ ...cfg, maxStake: 1e15, stakeSteps: [10, 1e15] }).ok).toBe(false); // batas atas taruhan
  });
  it("tidak ada fitur bonus: hasil hanya grid/wins/scatter", () => {
    const r = slots5Engine.start(cfg, { stake: 50 }, sequenceRng(Array(15).fill(0)));
    expect(Object.keys(r.outcome).sort()).toEqual(["grid", "multiplier", "scatter", "stake", "wins"]);
  });
});
