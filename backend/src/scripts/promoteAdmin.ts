// Bootstrap admin yang aman: tidak ada kredensial bawaan. Daftarkan akun biasa lewat aplikasi, lalu
// jalankan di server/komputer operator:  npm run admin:promote -- email@contoh.com
import { one, run, tx } from "../db";
import { iso } from "../lib/clock";
import { audit } from "../services/admin";

const email = process.argv[2];
if (!email) {
  console.error("Pemakaian: npm run admin:promote -- <email>");
  process.exit(1);
}
const u = one<{ id: string; role: string }>("SELECT id,role FROM users WHERE email=? COLLATE NOCASE AND status='ACTIVE'", email);
if (!u) {
  console.error("Akun aktif dengan email itu tidak ditemukan. Daftar dulu lewat /register.");
  process.exit(1);
}
tx(() => {
  run("UPDATE users SET role='ADMIN', updated_at=? WHERE id=?", iso(), u.id);
  audit(u.id, "ADMIN_BOOTSTRAP", "user", u.id, "promosi lewat CLI operator");
});
console.log(`OK: ${email} sekarang ADMIN.`);
