import { afterEach, describe, expect, it } from "vitest";
import { setDbSyncHook, syncDb } from "../src/db/persistence";

describe("persistensi: group commit", () => {
  afterEach(() => setDbSyncHook(null));

  it("tanpa hook: no-op", async () => {
    await syncDb();
  });

  it("30 sinkronisasi bersamaan → hanya 2 unggahan, semua menunggu unggahan yang memuat tulisannya", async () => {
    let calls = 0;
    const order: string[] = [];
    setDbSyncHook(async () => {
      const n = ++calls;
      order.push(`start${n}`);
      await new Promise((r) => setTimeout(r, 30));
      order.push(`end${n}`);
    });
    const first = syncDb(); // memulai unggahan #1
    await new Promise((r) => setTimeout(r, 5));
    const rest = Array.from({ length: 29 }, () => syncDb()); // datang saat #1 berjalan
    await Promise.all([first, ...rest]);
    expect(calls).toBe(2);
    expect(order).toEqual(["start1", "end1", "start2", "end2"]); // #2 dimulai setelah #1 selesai
  });

  it("error hook tidak memutus rantai dan tidak melempar ke pemanggil", async () => {
    let calls = 0;
    setDbSyncHook(async () => { calls++; throw new Error("storage mati"); });
    await syncDb();
    await syncDb();
    expect(calls).toBe(2);
  });
});
