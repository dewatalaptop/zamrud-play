// tsc hanya mengompilasi .ts; schema.sql dibaca saat runtime relatif ke __dirname.
const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "..", "src", "backend", "db", "schema.sql");
const dest = path.join(__dirname, "..", "lib", "backend", "db", "schema.sql");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Copied ${src} -> ${dest}`);
