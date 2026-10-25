# API

Format: sukses `{ "ok": true, "data": ... }`, gagal `{ "ok": false, "error": { "code", "message", ... } }`. `code` diterjemahkan di frontend (`errors.<CODE>`).

Metode mengubah data wajib header `x-zamrud-csrf: 1` (dan `Origin` harus sama dengan host bila ada). Auth lewat cookie `__session`. Validasi Zod (`strict`) di setiap rute. Riwayat memakai kursor (`limit`, `cursor`); tabel admin memakai `page`/`pageSize`.

Status: 400 validasi · 401 belum login · 402 saldo kurang · 403 dilarang · 404 · 409 konflik/duplikat · 429 rate limit.

## Publik
| | |
|---|---|
| GET `/api/health` | status |
| GET `/api/games`, `/api/games/:slug` | katalog + aturan/paytable dari konfigurasi aktif |
| GET `/api/leaderboard` | XP, hanya pemain yang opt-in |

## Auth
POST `/api/auth/register` · `/login` · `/logout` · `/change-password` · `/delete-account` · `/heartbeat`

## Pemain (login)
| | |
|---|---|
| GET `/api/me`, `/api/me/dashboard` | profil, preferensi, saldo, level |
| PATCH `/api/me/profile`, `/api/me/preferences` | |
| POST `/api/me/recommendations/reset`; DELETE `/api/me/events` | privasi |
| POST `/api/me/tutorial`, `/api/me/events`, `/api/me/support` | |
| GET/PUT/DELETE `/api/me/favorites[/:slug]` | |
| GET/PUT `/api/me/responsible-play`; POST/DELETE `/api/me/responsible-play/break` | |
| GET `/api/wallet`, `/api/wallet/transactions` | saldo, status harian, riwayat ledger |
| POST `/api/wallet/daily-claim`, `/api/wallet/promo` | hadiah gratis (idempoten) |
| POST `/api/games/:slug/sessions` `{requestId,input}` | mulai ronde (instan: selesai di respons) |
| GET `/api/games/:slug/active` · POST `/api/games/:slug/rules-viewed` | |
| GET `/api/sessions/:id` · POST `/api/sessions/:id/actions` `{clientActionId,expectedSeq,action}` | blackjack |
| GET `/api/missions` · POST `/api/missions/:id/claim` `{periodKey}` | |
| GET `/api/achievements`, `/api/statistics`, `/api/history` · POST `/api/statistics/view` | |

Tidak ada endpoint untuk mengubah saldo, transfer, pembelian, atau penarikan.

## Admin (`ADMIN` saja → 403 `ADMIN_ONLY`)
GET `/api/admin/analytics?days=7|30|90` · users (`GET /users?q&page`, `GET /users/:id`, `POST /users/:id/status|adjust-balance|demo-reset`, alasan wajib) · games (`GET /games`, `PATCH /games/:id`, `POST /games/:id/validate|configs`, `POST /games/:id/configs/:v/publish`) · missions (`GET/POST /missions`, `PATCH /missions/:id`) · economy (`GET/PUT /economy`, `POST /promos`, `POST /promos/:id/active`) · `GET /audit-logs` · support (`GET /support`, `POST /support/:id/resolve`).
