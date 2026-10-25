// Meluncurkan server e2e dengan database kosong (terpisah dari data pengembangan).
const fs = require("fs");
const path = require("path");
const db = process.env.DB_PATH;
fs.mkdirSync(path.dirname(db), { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(db + suffix, { force: true });
require("../backend/dist/server.js");
