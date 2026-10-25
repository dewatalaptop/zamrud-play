// `firebase deploy` hanya mengunggah folder functions/, jadi backend/src dicerminkan ke functions/src/backend
// sebelum tsc. backend/ tetap satu-satunya sumber kebenaran. WAJIB dijalankan sebelum tiap deploy
// (`npm run build` di functions/) — deploy tanpa ini bisa melompati perubahan secara diam-diam.
const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "..", "..", "backend", "src");
const dest = path.join(__dirname, "..", "src", "backend");
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true, filter: (f) => !f.endsWith(".test.ts") });
console.log(`Copied ${src} -> ${dest}`);
