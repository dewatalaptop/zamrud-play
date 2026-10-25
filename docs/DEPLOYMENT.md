# Deployment

## A. Mandiri (satu server Node)
```bash
npm run install:all && npm run build
DB_PATH=/var/data/zamrud.db PORT=8080 NODE_ENV=production npm start
```
Letakkan di belakang HTTPS (reverse proxy). `NODE_ENV=production` mengaktifkan cookie `Secure` dan HSTS. Pastikan folder DB persisten dan dicadangkan (`sqlite3 zamrud.db ".backup backup.db"`). Satu proses = satu penulis.

## B. Firebase (pola ai-app-builder)
Hosting menyajikan `frontend/dist`; `/api/**` diteruskan ke Cloud Function **`zamrudPlayApi`** (jangan pernah dinamai `api`), region `asia-southeast2`, `maxInstances: 1`, codebase `zamrudplay`. Hosting hanya meneruskan cookie bernama `__session`, itulah nama cookie sesi.

Persistensi: Cloud Functions tidak punya disk tetap. `functions/src/index.ts` memulihkan berkas SQLite dari Cloud Storage (`zamrud-play-db/data.db`) saat cold start dan mengunggahnya setelah setiap mutasi (di-checkpoint WAL lebih dulu). Detak durasi sesi dan event opsional sengaja tidak memicu unggahan.

```bash
# 1x: situs Hosting khusus
npx firebase-tools hosting:sites:create zamrud-play --project ai-app-builder-7bf8e
# tiap rilis (WAJIB build functions agar cermin backend segar)
npm run build                              # frontend + backend
npm --prefix functions install && npm --prefix functions run build
npx firebase-tools deploy --only hosting,functions --project ai-app-builder-7bf8e
# 1x setelah functions pertama: bersihkan image lama
npx firebase-tools functions:artifacts:setpolicy --location asia-southeast2 --force
```
Setelah situs baru dibuat, tambahkan `zamrud-play.web.app` ke `authorizedDomains` Identity Toolkit **hanya bila** nanti memakai Google Sign-In (aplikasi ini memakai auth sendiri, jadi tidak wajib).

Admin di produksi: daftar akun lewat situs, lalu jalankan skrip promosi terhadap salinan DB (unduh dari Storage → `npm run admin:promote -- email` → unggah) atau jalankan skrip dari lingkungan yang memiliki akses ke berkas DB yang sama. Jangan menyeed kredensial admin.

Verifikasi pascadeploy: `curl https://zamrud-play.web.app/api/health`, daftar akun, mainkan satu ronde, muat ulang halaman (sesi & saldo bertahan), cek `Set-Cookie: __session` memiliki `Secure; HttpOnly`.

## Batasan skala
SQLite + satu instance cukup untuk demo/beban kecil. Untuk skala besar pindahkan `backend/src/db` ke Postgres/Cloud SQL (semua akses lewat `tx/one/all/run`, invarian ledger harus dipertahankan: transaksi + `CHECK` + unik idempotensi).
