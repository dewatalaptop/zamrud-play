// Menyalin berkas non-.ts (schema.sql) ke dist/ setelah tsc.
const fs = require("fs");
fs.mkdirSync("dist/db", { recursive: true });
fs.copyFileSync("src/db/schema.sql", "dist/db/schema.sql");
