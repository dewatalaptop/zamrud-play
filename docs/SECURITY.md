# Catatan keamanan

| Ancaman | Kontrol | Bukti uji |
|---|---|---|
| Manipulasi saldo/payout dari browser | Tidak ada endpoint mutasi saldo; Zod `strict`; hasil server | api.test: "klien tidak bisa menyuntik payout", "tidak ada endpoint transfer" |
| Klaim ganda / replay | Kunci idempotensi unik di ledger; `requestId`, `clientActionId` | klaim harian paralel ×20 → 1 sukses; replay ronde |
| Saldo negatif / race | `tx()` BEGIN IMMEDIATE, update bersyarat, `CHECK(balance>=0)` | tes saldo kurang tanpa jejak; rekonsiliasi global |
| Ledger diubah | Trigger append-only | tes UPDATE/DELETE ditolak |
| IDOR | Sesi/riwayat difilter `user_id`; sesi orang lain → 404 | api.test IDOR |
| Eskalasi admin | `requireAdmin` server-side di semua rute admin; admin dibuat via CLI | 403 pada 12 endpoint admin |
| CSRF | Cookie SameSite=Lax + header kustom wajib + cek Origin | api.test CSRF, e2e |
| Pencurian sesi | Token acak 256-bit, hanya hash disimpan, HttpOnly, Secure di produksi, kedaluwarsa 14 hari, dicabut saat suspend/logout | tes logout mencabut sesi |
| Brute force | Rate limit per IP dan per identitas; waktu verifikasi seragam (hash tiruan) | tes 429 |
| Kebocoran kartu blackjack | `publicView` menyembunyikan kartu & shoe | unit + e2e |
| XSS/clickjacking | React escaping, CSP, X-Frame-Options DENY, nosniff | header diverifikasi |
| Injeksi SQL | Statement berparameter di semua query | — |
| Kebocoran error | Pesan 5xx generik; detail hanya di log | — |

Password: `scrypt` (N=16384, r=8, p=1, salt 16B). Rahasia tidak ada di repo; `.env.example` hanya placeholder. Kunci pelapor bug berada di bundle publik dan bukan rahasia (lihat CLAUDE.md §6 ai-app-builder).

Keterbatasan: rate limit di memori; belum ada 2FA/verifikasi email; CSP memakai `'unsafe-inline'` untuk skrip inisialisasi pelapor bug.
