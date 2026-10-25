# Zamrud Play

Platform **hiburan simulasi bergaya kasino** dengan **koin virtual gratis**. Tidak ada uang nyata, setoran, penarikan, pembayaran, kripto, transfer antar pemain, atau hadiah bernilai uang.

> Platform hiburan simulasi. Semua saldo dan hasil permainan bersifat virtual, tidak memiliki nilai uang, dan tidak dapat diuangkan.

Empat game dapat dimainkan (Slot Virtual, Roulette Eropa, Blackjack 21, Dadu Duel) dengan hasil 100% dihitung server, dompet berbasis ledger atomik, misi, pencapaian, statistik, fitur bermain sehat, personalisasi yang dapat dimatikan, dashboard admin, dan dua bahasa (Indonesia default, English).

## Stack (mengikuti arsitektur ai-app-builder)

| Lapisan | Teknologi |
|---|---|
| Frontend | Vite + React 18 + TypeScript (strict) + Tailwind 3 + token desain & ui-kit template, Framer Motion, Recharts, lucide-react |
| Backend | Node ≥ 22, Express, Zod, `node:sqlite` (tanpa kompilasi native) |
| Auth | Sesi opaque di DB (token acak, hanya hash SHA-256 disimpan), cookie `__session` HttpOnly + SameSite=Lax, hash password `scrypt` |
| Tes | Vitest (66 tes: unit game + integrasi HTTP), Playwright (15 skenario E2E di Chromium) |
| Deploy | Firebase Hosting (statis) + Cloud Function `zamrudPlayApi`, SQLite dipulihkan/disimpan ke Cloud Storage (lihat `docs/DEPLOYMENT.md`) |

> Catatan keputusan: prompt awal menyebut Next.js + PostgreSQL + Prisma + Docker. Sesuai arahan pemilik, proyek ini memakai arsitektur ai-app-builder yang sudah ada (Vite/React + Express + `node:sqlite`). PostgreSQL/Docker juga tidak terpasang di mesin pengembangan. Invarian saldo dijaga di level DB (lihat `docs/ARCHITECTURE.md`).

## Prasyarat

- Node.js **22+** (diuji di 24), npm 10+
- Untuk E2E: Chromium Playwright (`npx playwright install chromium`)

## Instalasi & menjalankan

```bash
npm run install:all          # root + backend + frontend
cp backend/.env.example backend/.env   # opsional; semua punya default
npm run dev                  # API :4000 + Vite :5173 (proxy /api)
```

Buka http://localhost:5173. Database dev otomatis dibuat (`backend/data.db`), skema + seed (game, konfigurasi v1, misi, pencapaian, kode promo demo `SELAMATDATANG`) berjalan idempoten saat start.

Mode satu-server (produksi lokal):

```bash
npm run build                # frontend → frontend/dist, backend → backend/dist
npm start                    # http://localhost:4000 (menyajikan SPA + API)
```

## Migrasi & seed

Skema ada di `backend/src/db/schema.sql` (`CREATE ... IF NOT EXISTS`), dijalankan setiap start; perubahan kolom ditambahkan lewat `migrateAddColumnIfMissing` di `backend/src/db/index.ts`. Seed (`backend/src/seed.ts`) idempoten dan **tidak membuat akun admin**.

## Bootstrap admin (aman, tanpa kredensial bawaan)

1. Daftar akun biasa lewat `/register`.
2. Di mesin operator/server: `npm run admin:promote -- email@anda.com` (menulis log audit `ADMIN_BOOTSTRAP`).

Rute admin dicek server-side di setiap permintaan (`requireAdmin`).

## Pengujian

```bash
npm test                     # Vitest backend (unit + integrasi)
npm run typecheck            # tsc backend + frontend
npm run i18n:check           # paritas ID/EN + semua kunci t("...") ada
npm run build && npm run test:e2e   # Playwright (butuh build; DB e2e terpisah)
npm run check                # typecheck + i18n + test + build
```

## Konfigurasi

Lihat `backend/.env.example`. Penting: `DB_PATH`, `PORT`, `TZ_OFFSET_MIN` (zona hari lokal, default WIB=420), `BUG_APP_ID/KEY` (pelapor bug otomatis).

## Dokumentasi

- `docs/ARCHITECTURE.md` — arsitektur & keputusan
- `docs/API.md` — endpoint
- `docs/GAME_RULES.md` — aturan, peluang, pembayaran, RTP
- `docs/SECURITY.md` — model ancaman & kontrol
- `docs/DEPLOYMENT.md` — deploy Firebase

## Batasan yang diketahui

- **Satu instance penulis**: di Firebase, DB SQLite disinkronkan ke Cloud Storage dengan `maxInstances: 1` (cocok untuk demo/beban kecil, tiap mutasi mengunggah berkas). Untuk skala besar, ganti lapisan `backend/src/db` ke Cloud SQL/Postgres (semua akses lewat `tx/one/all/run`).
- Pembatas laju disimpan di memori (instance tunggal).
- Blackjack tanpa split/insurance/surrender (sengaja, tidak diimplementasikan parsial).
- Tidak ada verifikasi email atau reset kata sandi lewat email.
- Hari lokal memakai offset tetap (`TZ_OFFSET_MIN`), bukan zona waktu per pengguna.
