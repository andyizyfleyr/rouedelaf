import "server-only";

import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";

/**
 * Couche d'accès Postgres.
 *
 * Un seul point d'entrée pour tout le code : la balise `sql`.
 *
 *   const lignes = await sql`SELECT * FROM cadeaux WHERE actif = true`;
 *
 * Deux pilotes, choisis automatiquement :
 *
 *  • NEON (production) — si l'URL pointe vers *.neon.tech, on utilise le
 *    driver HTTP officiel `@neondatabase/serverless` : aucune connexion TCP à
 *    maintenir, idéal en serverless, très faible latence.
 *
 *  • POSTGRES CLASSIQUE (développement, ou n'importe quel hébergeur) — pool
 *    `pg` mis en cache dans le processus pour éviter d'épuiser les
 *    connexions. Fonctionne avec un Postgres local, Docker, Railway…
 *
 * Les requêtes sont TOUJOURS paramétrées ($1, $2…) : aucune injection possible.
 */

const url = process.env.DATABASE_URL;

if (!url) {
  // Message volontairement neutre sur l'hébergement : la même variable se
  // renseigne en local (.env.local) et sur Vercel (Project → Settings →
  // Environment Variables). Les pages continuent de répondre (repli propre)
  // au lieu de faire échouer le build.
  console.warn(
    "[db] DATABASE_URL absente : les données ne peuvent pas être lues. Renseignez la variable (Neon) puis redéployez.",
  );
}

const CHAINE = url ?? "postgresql://invalid:invalid@localhost:5432/invalid";
const EST_NEON = /neon\.tech/i.test(CHAINE);

/* -------------------------------------------------------------------------- */
/*  Pilote A — Neon HTTP                                                       */
/* -------------------------------------------------------------------------- */

const neonHttp = EST_NEON ? neon(CHAINE) : null;

/* -------------------------------------------------------------------------- */
/*  Pilote B — pg (pool TCP)                                                   */
/* -------------------------------------------------------------------------- */

const globalPourPool = globalThis as unknown as { __rouePool?: Pool };

function obtenirPool(): Pool {
  if (globalPourPool.__rouePool) return globalPourPool.__rouePool;

  // `sslmode=require` est dans l'URL (voir .env.example). On force SSL dès que
  // l'hôte n'est pas local, ce qui couvre Neon, Supabase et la plupart des
  // hébergeurs managés.
  const estLocal = /@(localhost|127\.0\.0\.1|::1)[:/]/.test(CHAINE) || /\/\/(localhost|127\.0\.0\.1)[:/]/.test(CHAINE);

  const pool = new Pool({
    connectionString: CHAINE,
    max: Number(process.env.PGPOOL_MAX ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: estLocal ? undefined : { rejectUnauthorized: false },
  });

  // Un pool qui reste ouvert en développement (rechargement à chaud).
  globalPourPool.__rouePool = pool;
  return pool;
}

/* -------------------------------------------------------------------------- */
/*  Balise SQL unifiée                                                         */
/* -------------------------------------------------------------------------- */

type Ligne = Record<string, unknown>;

/** Construit `SELECT … WHERE a = $1 AND b = $2` à partir du gabarit. */
function construireRequete(
  morceaux: TemplateStringsArray,
  valeurs: unknown[],
): { texte: string; parametres: unknown[] } {
  let texte = "";
  for (let i = 0; i < morceaux.length; i += 1) {
    texte += morceaux[i];
    if (i < valeurs.length) texte += `$${i + 1}`;
  }
  return { texte, parametres: valeurs };
}

/**
 * Exécute une requête paramétrée et renvoie les lignes.
 *
 *   const [cadeau] = await sql`SELECT * FROM cadeaux WHERE id = ${id}`;
 */
export async function sql(
  morceaux: TemplateStringsArray,
  ...valeurs: unknown[]
): Promise<Ligne[]> {
  const { texte, parametres } = construireRequete(morceaux, valeurs);

  if (neonHttp) {
    // Le driver HTTP attend des paramètres sérialisables.
    return (await neonHttp.query(texte, parametres as never)) as Ligne[];
  }

  const pool = obtenirPool();
  const resultat = await pool.query(texte, parametres);
  return resultat.rows as Ligne[];
}

/* -------------------------------------------------------------------------- */
/*  Erreurs métier                                                             */
/* -------------------------------------------------------------------------- */

export type CodeErreurMetier =
  | "CADEAU_INDISPONIBLE"
  | "DEJA_PARTICIPE"
  | "NON_TROUVE"
  | "CONFLIT"
  | "BLOQUE";

/** Erreur métier destinée à être affichée au client (message en français). */
export class ErreurMetier extends Error {
  constructor(
    message: string,
    public readonly code: CodeErreurMetier,
  ) {
    super(message);
    this.name = "ErreurMetier";
  }
}

/**
 * Traduit une erreur Postgres en erreur métier lisible.
 * Les fonctions SQL lèvent des messages stables (CADEAU_INDISPONIBLE…).
 */
export function traduireErreur(e: unknown): ErreurMetier {
  const message = e instanceof Error ? e.message : String(e);
  if (message.includes("CADEAU_INDISPONIBLE")) {
    return new ErreurMetier("Ce cadeau n'est plus disponible.", "CADEAU_INDISPONIBLE");
  }
  if (message.includes("participants_telephone_unique") || message.includes("duplicate key")) {
    return new ErreurMetier("Ce numéro a déjà participé.", "DEJA_PARTICIPE");
  }
  if (message.includes("CODE_UNIQUE")) {
    return new ErreurMetier("Impossible de générer un code, réessayez.", "CONFLIT");
  }
  console.error("[db] erreur inattendue", e);
  return new ErreurMetier("Une erreur est survenue. Réessayez dans un instant.", "CONFLIT");
}

/** Vérifie que la base répond (utilisé par /api/sante et l'admin). */
export async function baseDisponible(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
