# Aturan, peluang, dan pembayaran

Semua nilai koin bilangan bulat. "Kelipatan" = total pengembalian termasuk taruhan. Konfigurasi default = versi 1 (`backend/src/games/*.ts`); admin dapat menerbitkan versi baru (divalidasi). Setiap ronde menyimpan versi yang berlaku. Ronde saling independen; konfigurasi sama untuk semua pemain.

## Slot Virtual (3 gulungan)
Bobot simbol per gulungan (total 100): Ceri 30 · Lemon 25 · Lonceng 18 · Semanggi 12 · Bintang 8 · Berlian 5 · Tujuh 2.
- 3 sama: Ceri 5× · Lemon 8× · Lonceng 15× · Semanggi 25× · Bintang 50× · Berlian 100× · Tujuh 250×
- Tepat 2 sama: Ceri 2×; Lonceng/Semanggi/Bintang/Berlian/Tujuh 1×; Lemon 0
- Semua berbeda: 0
- **RTP teoretis 95,25%** (dihitung eksak dari 100³ kombinasi; tes memverifikasi). Konfigurasi dengan RTP > 100% atau < 50% ditolak.

## Roulette Eropa (37 kantong)
Hingga `maxBets` (6) taruhan per putaran, masing-masing dihitung sendiri. Angka 36× · Hijau(0) 36× · Lusinan 3× · Merah/Hitam/Ganjil/Genap/1–18/19–36 2×. Kantong 0 mengalahkan semua taruhan selain angka 0/hijau. RTP tiap jenis taruhan = 36/37 = **97,3%**.

## Blackjack 21 (shoe 6 dek, kocok baru tiap ronde)
Dealer berhenti di semua 17 (termasuk soft 17). Blackjack alami 3:2 (bagian 3:2 dibulatkan ke bawah). Menang 1:1, seri mengembalikan taruhan. Double down hanya pada 2 kartu pertama (taruhan tambahan = awal, tepat 1 kartu, lalu stand otomatis). Tanpa split/insurance/surrender. Dealer mengintip blackjack di awal. Shoe dan kartu tertutup tidak pernah dikirim ke klien.

## Dadu Duel (1–100)
Pilih Di bawah / Di atas target. Jumlah angka menang k (Di bawah: target−1; Di atas: 100−target), k ∈ [5, 95]. Pengembalian = ⌊taruhan × 99 ÷ k⌋ (dibulatkan ke bawah). RTP maksimum **99%**.

## Kebijakan pembulatan
Selalu ke bawah (floor), tidak pernah menguntungkan pemain; satu-satunya pembagian: pengembalian dadu dan bagian 3:2 blackjack.
