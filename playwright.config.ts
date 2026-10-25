import { defineConfig, devices } from "@playwright/test";
import fs from "fs";
import path from "path";

// Bila Chromium versi persis yang diminta Playwright belum terpasang, pakai Chromium terpasang terbaru
// (atau CHROMIUM_PATH). Normalnya `npx playwright install chromium` sudah cukup.
function findChromium(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright");
  try {
    const dirs = fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort();
    const manifest = path.join(path.dirname(require.resolve("playwright-core/package.json")), "browsers.json");
    const want = JSON.parse(fs.readFileSync(manifest, "utf8")).browsers.find((b: any) => b.name === "chromium")?.revision;
    if (dirs.includes(`chromium-${want}`)) return undefined; // versi yang diminta tersedia
    const exe = path.join(root, dirs[dirs.length - 1] ?? "", "chrome-win64", "chrome.exe");
    return fs.existsSync(exe) ? exe : undefined;
  } catch {
    return undefined;
  }
}

const PORT = 4311;
export const E2E_DB = path.join(__dirname, "backend", ".local", "e2e.db");

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath: findChromium() },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: findChromium() } } }],
  webServer: {
    // Menjalankan build produksi: backend menyajikan frontend/dist (jalankan `npm run build` dulu).
    command: "node e2e/start-server.js",
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { PORT: String(PORT), DB_PATH: E2E_DB },
  },
});
