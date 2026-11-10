// Vérifie que le schéma SQL s'exécute sur un vrai Postgres (PGlite/WASM).
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = await PGlite.create();

const run = async (file) => {
  const sql = readFileSync(file, "utf8");
  await db.exec(sql);
  console.log(`✅ ${file} exécuté`);
};

await run("sql/schema.sql");
await run("sql/schema.sql"); // idempotence
await run("sql/seed.sql");

const t = await db.query("select count(*)::int as n from cadeaux");
console.log("cadeaux =", t.rows[0].n);

// Test de la fonction de tirage
const p = await db.query(
  "insert into participants (nom, telephone, telephone_aff, source) values ('Test', '22991000000', '+229 91 00 00 00', 'direct') returning id",
);
const pid = p.rows[0].id;
const r = await db.query(
  "select * from enregistrer_tirage($1,$2,$3,$4,$5,$6)",
  [pid, 2, 14, false, "dev", "iphash"],
);
console.log("tirage =", r.rows[0]);
// Le participant n'a qu'un tour (tours_max = 1) : un second tirage doit être
// REFUSÉ par la base elle-même (c'est la garantie « un tour par personne »).
let refuse = false;
try {
  await db.query("select * from enregistrer_tirage($1, NULL, 14, true, NULL, NULL)", [pid]);
} catch (e) {
  refuse = /TOURS_EPUISES/.test(String(e.message));
}
console.log("2ᵉ tirage refusé par la base =", refuse ? "✅ oui" : "❌ NON");
if (!refuse) process.exit(1);

// Avec un tour bonus, il redevient autorisé.
await db.query("update participants set tours_bonus = 1 where id = $1", [pid]);
const r2 = await db.query("select * from enregistrer_tirage($1, NULL, 14, true, NULL, NULL)", [pid]);
console.log("tirage bonus (perdu) =", r2.rows[0].statut);
const stock = await db.query("select stock from cadeaux where id = 2");
console.log("stock cadeau 2 =", stock.rows[0].stock);
const v = await db.query("select count(*)::int as n from derniers_gagnants");
console.log("vue derniers_gagnants =", v.rows[0].n);
console.log("✅ OK");
process.exit(0);
