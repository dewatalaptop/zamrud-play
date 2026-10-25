// Memeriksa terjemahan: (1) id & en punya kunci yang sama persis, (2) setiap t("kunci") statis di
// kode ada di kedua bahasa, (3) placeholder {param} sama di kedua bahasa.
import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..", "src");
const load = (lang) => {
  const out = {};
  for (const f of fs.readdirSync(path.join(root, "i18n", lang))) {
    if (!f.endsWith(".json")) continue;
    out[f.replace(".json", "")] = JSON.parse(fs.readFileSync(path.join(root, "i18n", lang, f), "utf8"));
  }
  return out;
};
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flat(v, p + k + ".") : [[p + k, v]]));
const id = Object.fromEntries(flat(load("id")));
const en = Object.fromEntries(flat(load("en")));
let bad = 0;
const fail = (m) => { console.error("✗ " + m); bad++; };

for (const k of Object.keys(id)) if (!(k in en)) fail(`hilang di en: ${k}`);
for (const k of Object.keys(en)) if (!(k in id)) fail(`hilang di id: ${k}`);
const ph = (s) => (String(s).match(/\{\w+\}/g) ?? []).sort().join(",");
for (const k of Object.keys(id)) if (k in en && ph(id[k]) !== ph(en[k])) fail(`placeholder beda: ${k}`);

const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== "i18n") walk(p); } else if (/\.tsx?$/.test(e.name)) files.push(p); } })(root);
const used = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/\bt\(\s*"([A-Za-z0-9_.\-]+)"/g)) used.add(m[1]);
  for (const m of src.matchAll(/\bt\(\s*`([A-Za-z0-9_.\-]+)\$\{/g)) {
    // kunci dinamis: pastikan setidaknya ada kunci dengan awalan itu
    const prefix = m[1];
    if (!Object.keys(id).some((k) => k.startsWith(prefix))) fail(`awalan dinamis tak dikenal: ${prefix} (${path.relative(root, f)})`);
  }
}
for (const k of used) if (!(k in id)) fail(`kunci dipakai tapi tidak ada: ${k}`);
console.log(`${Object.keys(id).length} kunci · ${used.size} kunci statis dipakai · ${bad ? bad + " masalah" : "OK"}`);
process.exit(bad ? 1 : 0);
