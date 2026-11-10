import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import { Client } from "pg";

import { sql } from "@/lib/db";

/**
 * Initialisation de la base depuis l'application (donc depuis Vercel).
 *
 * Utilité : `scripts/db-setup.mjs` ouvre une connexion Postgres directe
 * depuis le poste de travail. Sur un réseau filtré (proxy d'entreprise,
 * sandbox, wifi public) cette connexion échoue, alors que la même base est
 * parfaitement joignable depuis Vercel. Cette fonction rejoue donc
 * `sql/schema.sql` côté serveur Next.js.
 *
 * Pourquoi une connexion `pg` dédiée plutôt que la balise `sql` ?
 *  - Le fichier SQL contient plusieurs instructions (tables, fonctions,
 *    politiques, vues). Le pilote HTTP de Neon n'accepte qu'une requête par
 *    appel ; le protocole simple de `pg` accepte le script entier, exactement
 *    comme `psql`.
 *  - Une connexion courte, fermée en fin de traitement, évite de polluer le
 *    pool utilisé par les requêtes applicatives.
 *
 * Deux précautions :
 *  • Si la base est déjà peuplée (des cadeaux existent) et que l'appelant n'a
 *    pas demandé `forcer`, on s'arrête : jamais d'écrasement silencieux.
 *  • Le SQL est idempotent (CREATE TABLE IF NOT EXISTS / ON CONFLICT) : une
 *    seconde exécution ne casse rien.
 */

/**
 * Vérifie que le schéma est en place ; sinon l'applique.
 *
 * Appelée par /api/inscription et /api/tirage AVANT d'écrire : si la base est
 * neuve (cas d'un premier déploiement), les tables sont créées à la volée au
 * lieu de laisser le client devant une erreur 500. Le travail est fait une
 * seule fois puis mémorisé par processus, donc le coût est nul ensuite.
 */
let promesseSchema: Promise<void> | null = null;
let schemaVerifie = false;

export async function assurerSchema(): Promise<void> {
  if (schemaVerifie) return;
  if (!promesseSchema) {
    promesseSchema = (async () => {
      const lignes = await sql`SELECT to_regclass('public.parametres') AS t`;
      const existe = Boolean((lignes[0] as { t?: string } | undefined)?.t);
      if (!existe) {
        console.warn("[init] base vide détectée : création du schéma…");
        await initialiserBase({ forcer: false });
      }
      schemaVerifie = true;
    })().catch((e) => {
      // On ne mémorise pas l'échec : la prochaine requête réessaiera.
      promesseSchema = null;
      throw e;
    });
  }
  await promesseSchema;
}

export type ResultatInit = {
  ok: boolean;
  dejaInitialise: boolean;
  tables: string[];
  cadeaux: number;
  message?: string;
};

function lireSql(nom: string): string {
  return readFileSync(path.join(process.cwd(), "sql", nom), "utf8");
}

export async function initialiserBase(opts: { forcer?: boolean } = {}): Promise<ResultatInit> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL absente : impossible de joindre la base.");

  const estLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const client = new Client({
    connectionString: url,
    ssl: estLocal ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
    statement_timeout: 60_000,
  });

  await client.connect();
  try {
    // 1. La base est-elle déjà préparée ?
    let dejaInitialise = false;
    try {
      const { rows } = await client.query(
        "SELECT to_regclass('public.cadeaux') IS NOT NULL AS existe",
      );
      dejaInitialise = Boolean(rows[0]?.existe);
    } catch {
      dejaInitialise = false;
    }

    if (dejaInitialise && !opts.forcer) {
      const { rows } = await client.query("SELECT count(*)::int AS n FROM cadeaux");
      const cadeaux = Number(rows[0]?.n ?? 0);
      if (cadeaux > 0) {
        return {
          ok: true,
          dejaInitialise: true,
          tables: [],
          cadeaux,
          message:
            "Base déjà initialisée : aucune action. Utilisez ?forcer=1 pour réappliquer le schéma.",
        };
      }
    }

    // 2. Schéma complet puis cadeaux de démonstration.
    await client.query(lireSql("schema.sql"));
    await client.query(lireSql("seed.sql"));

    // 3. Compte rendu lisible pour l'admin.
    const { rows: tables } = await client.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name`,
    );
    const { rows: compte } = await client.query("SELECT count(*)::int AS n FROM cadeaux");

    return {
      ok: true,
      dejaInitialise,
      tables: (tables as { table_name: string }[]).map((t) => t.table_name),
      cadeaux: Number(compte[0]?.n ?? 0),
      message: "Schéma appliqué et cadeaux de démonstration insérés.",
    };
  } finally {
    await client.end().catch(() => {});
  }
}
