/**
 * Initialise la base : exécute sql/schema.sql puis (option) sql/seed.sql.
 *
 *   npm run db:setup        → schéma + réglages
 *   npm run db:seed         → schéma + cadeaux de démonstration
 *
 * Fonctionne avec Neon (DATABASE_URL) comme avec le Postgres local de dev.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL manquante. Copiez .env.example vers .env.local.");
  process.exit(1);
}

const seed = process.argv.includes("--seed");
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  console.log("→ Connexion OK");

  await client.query(readFileSync("sql/schema.sql", "utf8"));
  console.log("✅ sql/schema.sql appliqué");

  await client.query(readFileSync("sql/seed.sql", "utf8"));
  console.log("✅ sql/seed.sql appliqué (cadeaux de démonstration)");

  const { rows } = await client.query("SELECT count(*)::int AS n FROM cadeaux");
  console.log(`🎁 ${rows[0].n} cadeaux en base`);
  if (!seed) console.log("ℹ️  Astuce : npm run db:seed pour garder les cadeaux de démo.");
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  console.error("❌ Échec :", message.split("\n")[0]);
  if (message.includes("DATABASE_URL")) {
    console.error("   Vérifiez la chaîne de connexion Neon (hostname -pooler, sslmode=require).");
  }
  process.exitCode = 1;
} finally {
  await client.end();
}
