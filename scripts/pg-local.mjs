/**
 * ⚠️ OUTIL DE DÉVELOPPEMENT — NE PAS DÉPLOYER EN PRODUCTION
 *
 * Lance un vrai serveur PostgreSQL (PGlite, Postgres compilé en WebAssembly)
 * qui parle le protocole wire Postgres sur le port 5432. Permet de développer
 * et tester l'application sans installer Postgres.
 *
 *   node scripts/pg-local.mjs
 *
 * Les données sont conservées dans `.pgdata/` (ignoré par git).
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { mkdirSync } from "node:fs";

const DOSSIER = ".pgdata";
mkdirSync(DOSSIER, { recursive: true });

const db = await PGlite.create({ dataDir: DOSSIER });
const server = new PGLiteSocketServer({
  db,
  port: Number(process.env.PGPORT ?? 5432),
  host: process.env.PGHOST ?? "0.0.0.0",
  // PGlite est mono-connexion : on autorise plusieurs clients TCP (Next.js,
  // psql, scripts) qui sont sérialisés au niveau requête. Sans cela, toute
  // seconde connexion est coupée et l'application voit des ECONNRESET.
  maxConnections: 16,
  idleTimeout: 0,
});

await server.start();
console.log("🐘 PGlite prêt sur le port", process.env.PGPORT ?? 5432);

const arreter = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", arreter);
process.on("SIGTERM", arreter);
