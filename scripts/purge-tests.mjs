import pg from "../node_modules/pg/lib/index.js";
const c = new pg.Client("postgresql://postgres:postgres@127.0.0.1:5432/postgres");
await c.connect();
const avant = await c.query("SELECT id, nom, image_url FROM cadeaux ORDER BY ordre");
console.log("avant:", avant.rows.map((r) => `${r.id}:${r.nom}`).join(" | "));
// On retire les lots créés par les tests Playwright (et leurs tirages).
await c.query("DELETE FROM tirages WHERE cadeau_id IN (SELECT id FROM cadeaux WHERE nom IN ('Mug boutique') OR nom LIKE 'Test %')");
await c.query("DELETE FROM cadeaux WHERE nom IN ('Mug boutique') OR nom LIKE 'Test %'");
const apres = await c.query("SELECT id, nom, couleur FROM cadeaux ORDER BY ordre");
console.log("apres:", apres.rows.map((r) => `${r.id}:${r.nom}:${r.couleur}`).join(" | "));
await c.end();
