import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { expect, test, type Page } from "@playwright/test";
import { E2E_DB } from "../playwright.config";

// Kuota registrasi dibatasi server (8/jam per IP) — suite ini hanya membuat 3 akun.
const stamp = Date.now().toString(36);
const player = { email: `pemain-${stamp}@uji.dev`, username: `pemain_${stamp}`, name: "Pemain Uji", password: "kata-sandi-aman-1" };
const admin = { email: `admin-${stamp}@uji.dev`, username: `admin_${stamp}`, name: "Admin Uji", password: "kata-sandi-aman-1" };

const closeDialog = (page: Page) => page.getByRole("dialog").getByRole("button", { name: "Tutup" }).last().click(); // tombol footer
const balanceText = async (page: Page) => (await page.getByRole("link", { name: /Saldo koin virtual:|Virtual coin balance:/ }).first().getAttribute("aria-label"))!;
const balanceNum = async (page: Page) => Number((await balanceText(page)).replace(/\D/g, ""));

test.describe.configure({ mode: "serial" });
const STATE = path.join(__dirname, ".auth", "player.json");

test("landing: bahasa default Indonesia, disclosure & CTA tampil, tanpa data palsu", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Rasakan suasana kasino");
  await expect(page.getByText("Platform hiburan simulasi. Semua saldo dan hasil permainan bersifat virtual, tidak memiliki nilai uang, dan tidak dapat diuangkan.").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Mulai Bermain Gratis" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lihat Permainan" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  // empat game dari server (bukan data tiruan)
  await expect(page.getByRole("heading", { name: "Slot Virtual" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Blackjack 21" })).toBeVisible();
});

test("papan peringkat kosong menampilkan empty state, bukan pemain palsu", async ({ page }) => {
  await page.goto("/leaderboard");
  await expect(page.getByText("Belum ada peringkat")).toBeVisible();
});

test("registrasi → dasbor dengan saldo awal 10.000 dan tur singkat", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Email").fill(player.email);
  await page.getByLabel("Nama pengguna").fill(player.username);
  await page.getByLabel("Nama tampilan").fill(player.name);
  await page.getByLabel("Kata sandi").fill(player.password);
  await expect(page.getByRole("button", { name: "Buat akun" })).toBeDisabled(); // belum setuju
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Buat akun" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Halo, Pemain Uji!" })).toBeVisible();
  expect(await balanceNum(page)).toBe(10000);
  await expect(page.getByText("Tur singkat (1 menit)")).toBeVisible();
  // cookie sesi HttpOnly bernama __session
  const cookies = await page.context().cookies();
  const s = cookies.find((c) => c.name === "__session");
  expect(s?.httpOnly).toBe(true);
  expect(s?.sameSite).toBe("Lax");
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  await page.context().storageState({ path: STATE }); // dipakai tes berikutnya (sesi pemain)
});

test.describe("pemain terautentikasi", () => {
test.use({ storageState: STATE });


test("tur singkat selesai → misi dapat diklaim dengan koin gratis", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Mulai tur" }).click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Berikutnya" }).click();
  await page.getByRole("button", { name: "Selesai" }).click();
  await page.goto("/missions");
  await page.getByRole("button", { name: "Klaim hadiah" }).first().click();
  await expect(page.getByText("Hadiah misi diterima: +1.000 koin virtual.")).toBeVisible();
  expect(await balanceNum(page)).toBe(11000);
});

test("klaim hadiah harian sekali; klaim ulang tidak tersedia", async ({ page }) => {
  await page.goto("/wallet");
  await page.getByRole("button", { name: /Ambil hadiah harian/ }).click();
  await expect(page.getByText(/Hadiah harian diterima: \+500/)).toBeVisible();
  expect(await balanceNum(page)).toBe(11500);
  await expect(page.getByRole("button", { name: /hari ini sudah diambil/ })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("button", { name: /hari ini sudah diambil/ })).toBeDisabled();
  await expect(page.getByText("Hadiah harian gratis").first()).toBeVisible();
  await expect(page.locator("li", { hasText: "Hadiah selamat datang" })).toBeVisible();
});

test("slots: aturan tampil dulu, putar, saldo berubah sesuai catatan dompet", async ({ page }) => {
  await page.goto("/play/virtual-slots");
  await expect(page.getByRole("dialog", { name: /Aturan — Slot Virtual/ })).toBeVisible();
  await expect(page.getByText(/Pengembalian rata-rata teoretis: 95,25%|Pengembalian rata-rata teoretis: 95.25%/)).toBeVisible();
  await page.getByRole("button", { name: "Saya mengerti" }).click();
  const before = await balanceNum(page);
  await page.getByRole("button", { name: /^Putar · / }).click();
  const result = page.getByRole("dialog", { name: "Hasil ronde" });
  await expect(result).toBeVisible({ timeout: 15000 });
  await expect(result.getByText("Koin virtual tidak bernilai uang dan tidak dapat diuangkan.")).toBeVisible();
  await closeDialog(page);
  const after = await balanceNum(page);
  // saldo = saldo awal − taruhan(50) + pengembalian; cocok dengan dompet di server
  await page.goto("/wallet");
  const tx = page.locator("li", { hasText: "Taruhan permainan" }).first();
  await expect(tx).toContainText("−50");
  expect(await balanceNum(page)).toBe(after);
  expect(after).toBeGreaterThanOrEqual(before - 50);
});

test("riwayat memuat ronde slots dengan versi aturan", async ({ page }) => {
  await page.goto("/history");
  const table = page.getByRole("table");
  await expect(table.getByText("Slot Virtual")).toBeVisible();
  await expect(table.getByText("v1")).toBeVisible();
});

test("dadu, roulette, dan blackjack dapat dimainkan", async ({ page }) => {
  // Dadu
  await page.goto("/play/dice-duel");
  await page.getByRole("button", { name: "Saya mengerti" }).click();
  await page.getByRole("button", { name: /^Lempar · / }).click();
  await expect(page.getByRole("dialog", { name: "Hasil ronde" })).toBeVisible({ timeout: 15000 });
  await closeDialog(page);
  // Roulette
  await page.goto("/play/euro-roulette");
  await page.getByRole("button", { name: "Saya mengerti" }).click();
  await page.getByRole("button", { name: /^Merah/ }).click();
  await page.getByRole("button", { name: /^Putar roda · / }).click();
  await expect(page.getByRole("dialog", { name: "Hasil ronde" })).toBeVisible({ timeout: 20000 });
  await closeDialog(page);
  // Blackjack: bagikan, kartu dealer tertutup (tidak bocor), lalu berhenti
  await page.goto("/play/blackjack-21");
  await page.getByRole("button", { name: "Saya mengerti" }).click();
  await page.getByRole("button", { name: /^Bagikan · / }).click();
  const stand = page.getByRole("button", { name: "Berhenti" });
  const done = page.getByRole("dialog");
  await expect(stand.or(done)).toBeVisible({ timeout: 10000 });
  if (await stand.isVisible()) {
    await expect(page.getByRole("img", { name: "hidden card" })).toBeVisible();
    // tidak ada data kartu tersembunyi/shoe di respons sesi aktif
    const active = await page.evaluate(async () => (await fetch("/api/games/blackjack-21/active")).text());
    expect(active).not.toMatch(/shoe/);
    await stand.click();
  }
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });
  await closeDialog(page);
  // Statistik mencerminkan ronde nyata
  await page.goto("/statistics");
  await expect(page.getByText("Perubahan Saldo Virtual").first()).toBeVisible();
  await expect(page.getByText("Koin Virtual Diperoleh").first()).toBeVisible();
});

test("preferensi tersimpan setelah muat ulang; personalisasi dapat dimatikan", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Kartu" }).first().click();
  await expect(page.getByText("Tersimpan").first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Kartu" }).first()).toHaveAttribute("aria-pressed", "true");
  await page.goto("/dashboard");
  await expect(page.getByText("Direkomendasikan karena Anda menyukai kategori Kartu.")).toBeVisible();
  await page.goto("/profile");
  await page.getByLabel(/Rekomendasi personal/).uncheck();
  await page.goto("/dashboard");
  await expect(page.getByText("Personalisasi dimatikan.")).toBeVisible();
  await expect(page.getByText(/Direkomendasikan karena/)).toHaveCount(0);
});

test("bahasa dapat diganti ke English dan tersimpan", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Bahasa").first().selectOption("en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByLabel("Language").first().selectOption("id");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pengaturan");
});

test("kontrol bermain sehat: jeda memblokir ronde baru", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "15 menit" }).click();
  await expect(page.getByText(/Anda sedang istirahat sampai/)).toBeVisible();
  await page.goto("/play/virtual-slots");
  await page.getByRole("button", { name: "Saya mengerti" }).click();
  await page.getByRole("button", { name: /^Putar · / }).click();
  await expect(page.getByText(/Anda sedang dalam jeda/)).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("button", { name: "Akhiri jeda sekarang" }).click();
  await expect(page.getByText(/Anda sedang istirahat sampai/)).toHaveCount(0);
});

test("navigasi responsif: bawah di mobile, atas di desktop", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/dashboard");
  const bottom = page.getByRole("navigation", { name: "Navigasi bawah" });
  await expect(bottom).toBeVisible();
  await bottom.getByRole("link", { name: "Dompet" }).click();
  await expect(page).toHaveURL(/\/wallet$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true); // tanpa scroll horizontal
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("link", { name: "Papan Peringkat" }).last()).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(bottom).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Navigasi utama" }).first()).toBeVisible();
});

test("tanpa login: halaman privat & admin diarahkan ke login; API admin menolak", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  for (const p of ["/dashboard", "/wallet", "/play/virtual-slots", "/admin", "/admin/users"]) {
    await page.goto(p);
    await expect(page).toHaveURL(/\/login$/);
  }
  const r = await page.request.get("/api/admin/users");
  expect(r.status()).toBe(401);
  await ctx.close();
});

test("pemain biasa tidak dapat mengakses admin (UI dan API)", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
  const status = await page.evaluate(async () => (await fetch("/api/admin/analytics", { headers: { "x-zamrud-csrf": "1" } })).status);
  expect(status).toBe(403);
  const csrf = await page.evaluate(async () => (await fetch("/api/wallet/daily-claim", { method: "POST" })).status);
  expect(csrf).toBe(403); // tanpa header CSRF
});

test("admin: bootstrap lewat CLI, lalu dasbor memuat data nyata & audit", async ({ page, browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const ap = await ctx.newPage();
  const reg = await ap.request.post("/api/auth/register", {
    headers: { "x-zamrud-csrf": "1" },
    data: { email: admin.email, username: admin.username, displayName: admin.name, password: admin.password },
  });
  expect(reg.ok()).toBe(true);
  // promosi lewat prosedur bootstrap terdokumentasi (bukan kredensial bawaan)
  execFileSync("node", [path.join("node_modules", "tsx", "dist", "cli.mjs"), "src/scripts/promoteAdmin.ts", admin.email], {
    cwd: path.join(__dirname, "..", "backend"), env: { ...process.env, DB_PATH: E2E_DB }, stdio: "pipe",
  });
  await ap.goto("/admin");
  await expect(ap.getByRole("heading", { level: 1, name: "Ringkasan" })).toBeVisible();
  await expect(ap.getByText("Pengguna terdaftar")).toBeVisible();
  await ap.goto("/admin/users");
  await expect(ap.getByText("Pemain Uji")).toBeVisible();
  await ap.getByRole("button", { name: /Pemain Uji/ }).click();
  const dlg = ap.getByRole("dialog");
  await dlg.getByLabel(/Alasan/).fill("kompensasi uji e2e");
  await dlg.getByPlaceholder("+500 / -200").fill("250");
  await dlg.getByRole("button", { name: "Terapkan" }).click();
  await expect(ap.getByText("Tersimpan").first()).toBeVisible();
  await ap.goto("/admin/audit-logs");
  await expect(ap.getByText("BALANCE_ADJUST")).toBeVisible();
  await ap.goto("/admin/games");
  await expect(ap.getByText("virtual-slots")).toBeVisible();
  await ap.goto("/admin/economy");
  await expect(ap.getByText("Semua saldo cocok dengan ledger.")).toBeVisible();
  await ctx.close();
  // pemain melihat penyesuaian di dompetnya
  await page.goto("/wallet");
  await expect(page.getByText(/Penyesuaian oleh admin — kompensasi uji e2e/)).toBeVisible();
});
});
