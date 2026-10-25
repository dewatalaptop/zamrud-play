# Arsitektur

Monolit modular: satu proses Express (API) + SPA React. Frontend dan API **same-origin** (`/api/**`), sehingga tanpa CORS.

```
frontend/src
  pages/ components/ components/games/ components/admin/   UI
  i18n/{id,en}/*.json + index.tsx                           terjemahan terstruktur
  lib/api.ts hooks.ts outcome.ts types.ts
backend/src
  db/            schema.sql + node:sqlite (tx() = BEGIN IMMEDIATE)
  games/         types.ts registry.ts rng.ts slots.ts roulette.ts blackjack.ts dice.ts
  services/      wallet auth gameplay progress responsible recommendations stats admin settings
  routes/        auth me games wallet progress admin (Zod di tiap rute)
  middleware/    security (CSRF, sesi, rate limit, CSP) errorHandler
```

## Keputusan kunci

1. **Server-authoritative.** Klien hanya mengirim niat (taruhan/aksi). Hasil, payout, kartu, dan saldo dihitung server. Skema Zod `strict()` menolak field asing (mass assignment), mis. `payout` atau `card`.
2. **Satu pintu saldo: `applyLedger()`** (`services/wallet.ts`). Cek kunci idempotensi → baca saldo → tolak bila hasil < 0 → update bersyarat (`WHERE balance = ?`) → tulis entri ledger dengan `balance_after`. Dibungkus `tx()` (transaksi tulis tunggal). Lapisan pertahanan DB: `CHECK(balance >= 0)`, `UNIQUE(idempotency_key)`, trigger yang membuat `wallet_transactions` **append-only**.
3. **Idempoten:** hadiah harian (`daily:user:hari:n`), misi (`mission:user:id:periode`), promo (`promo:id:user`), taruhan/pembayaran game (`stake:sid`, `payout:sid`). Ronde baru butuh `requestId` unik per pemain (`UNIQUE(user_id, request_id)`); aksi blackjack butuh `clientActionId` + `expectedSeq` (`UNIQUE(session_id, seq)`).
4. **Konfigurasi game berversi.** `game_configs(version, status)`; sesi menyimpan `config_version` dan `act()` memakai versi sesi itu, jadi aturan ronde berjalan tak berubah. Publikasi divalidasi ulang (struktur, batas taruhan, RTP ≤ 100%) dan diaudit.
5. **Bilangan bulat.** Semua koin integer; pembulatan floor terdokumentasi (`docs/GAME_RULES.md`). RTP slot dihitung eksak dengan enumerasi kombinasi.
6. **RNG tersuntik.** `secureRng` (crypto.randomInt) di produksi; `sequenceRng` deterministik di tes.
7. **Personalisasi tidak menyentuh game.** `recommendations.rank()` fungsi murni yang hanya mengurutkan katalog; tidak ada kode jalur game yang membaca preferensi/perilaku. Tes memastikan `rules` identik untuk semua pemain.
8. **Bermain sehat ditegakkan server** saat memulai ronde baru (`assertCanStartRound`): jeda, batas harian (dari detak durasi sisi server), cooldown. Ronde berjalan boleh diselesaikan agar taruhan tidak menggantung. Pengingat tidak dapat dimatikan.
9. **Privasi.** Event perilaku hanya dicatat bila personalisasi aktif dan dihapus saat dimatikan/direset. Hapus akun = anonimisasi; ledger dipertahankan tanpa identitas.

## Retensi

| Data | Retensi |
|---|---|
| `wallet_transactions`, `game_*` | Dipertahankan (audit); tanpa identitas setelah akun dihapus |
| `user_events` | Sampai pengguna hapus / matikan personalisasi / hapus akun |
| `auth_sessions` | 14 hari (sliding), dibersihkan saat sesi baru dibuat |
| `admin_audit_logs` | Dipertahankan |

## Skema (ringkas)

users, auth_sessions, user_profiles, user_preferences, wallets, wallet_transactions, games, game_configs, game_sessions, game_actions, game_results, missions, user_mission_progress, achievements, user_achievements, user_counters, user_favorites, user_events, session_summaries, promo_codes, promo_redemptions, responsible_settings, admin_audit_logs, settings, support_requests, api_metrics.
