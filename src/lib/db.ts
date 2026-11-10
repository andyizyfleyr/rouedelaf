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

type CachePool = { pool: Pool; cle: string };
const globalPourPool = globalThis as unknown as { __rouePool?: CachePool };

function obtenirPool(): Pool {
  // Le pool est mémorisé par processus, mais UNIQUEMENT pour la même chaîne de
  // connexion : si l'URL change (redéploiement, rotation du mot de passe), on
  // recrée le pool au lieu de réutiliser d'anciennes connexions mortes.
  if (globalPourPool.__rouePool?.cle === CHAINE) return globalPourPool.__rouePool.pool;

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

  // Un pool qui reste ouvert en développement (rechargement à chaud), et qui
  // survit à une invocation chaude en production.
  globalPourPool.__rouePool = { pool, cle: CHAINE };
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

/** Exécute une requête SANS passer par la vérification de schéma. */
async function executerBrut(texte: string, parametres: unknown[]): Promise<Ligne[]> {
  if (neonHttp) {
    // Le driver HTTP attend des paramètres sérialisables.
    return (await neonHttp.query(texte, parametres as never)) as Ligne[];
  }

  const pool = obtenirPool();
  const resultat = await pool.query(texte, parametres);
  return resultat.rows as Ligne[];
}

/* -------------------------------------------------------------------------- */
/*  Schéma auto-créé                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Sur un déploiement neuf, la base fournie par le client peut être vide : les
 * tables n'existent pas encore et la moindre lecture échoue. Plutôt que
 * d'afficher « Une erreur inattendue s'est produite » au premier visiteur (ou
 * au staff qui ouvre /admin), on crée le schéma à la première requête.
 *
 * Le test coûte un aller-retour par processus (ensuite mémorisé), et un échec
 * n'est jamais bloquant : la requête appelante garde la main sur son erreur.
 */
let schemaPret = false;
let verificationEnCours: Promise<void> | null = null;
/** Version de schéma déjà appliquée par ce processus (voir MIGRATIONS). */
const VERSION_SCHEMA = 8;

async function verifierSchema(): Promise<void> {
  if (schemaPret) return;
  if (!verificationEnCours) {
    verificationEnCours = (async () => {
      try {
        const lignes = await executerBrut("SELECT to_regclass('public.parametres') AS t", []);
        const existe = Boolean((lignes[0] as { t?: string } | undefined)?.t);
        if (!existe) {
          console.warn("[db] base vide détectée : création du schéma…");
          // Import paresseux : init.ts dépend de ce module, on casse le cycle.
          const { initialiserBase } = await import("@/server/init");
          await initialiserBase({ forcer: false });
          console.warn("[db] schéma créé.");
        } else {
          // Base déjà en service : on applique les migrations (remplacements
          // de fonctions uniquement, aucune donnée touchée). C'est ce qui
          // corrige une base créée avant la correction « un tour par personne ».
          await appliquerMigrations();
        }
        schemaPret = true;
      } catch (e) {
        // Base injoignable ou droits insuffisants : on ne masque rien, mais on
        // ne bloque pas la requête. La prochaine tentative réessaiera.
        console.warn("[db] vérification du schéma impossible", e);
      } finally {
        verificationEnCours = null;
      }
    })();
  }
  await verificationEnCours;
}

/**
 * Applique `sql/migrations.sql` une seule fois par processus.
 *
 * Pourquoi pas `schema.sql` ? Il crée les tables ; sur une base déjà remplie
 * il ne servirait à rien et pourrait surprendre (re-seed). Les migrations ne
 * contiennent que des `CREATE OR REPLACE FUNCTION` : rejouables à l'infini.
 *
 * Un échec n'est jamais bloquant : on continue avec l'ancienne version du
 * schéma (l'application reste fonctionnelle) et on réessaiera au prochain
 * démarrage à froid.
 */
async function appliquerMigrations(): Promise<void> {
  try {
    const [ligne] = await executerBrut(
      "SELECT COALESCE((SELECT valeur FROM parametres WHERE cle = 'schema_version'), '0') AS v",
      [],
    );
    if (Number((ligne as { v?: string } | undefined)?.v ?? 0) >= VERSION_SCHEMA) return;

    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const fichier = path.join(process.cwd(), "sql", "migrations.sql");
    let script: string;
    try {
      script = readFileSync(fichier, "utf8");
    } catch {
      // Fonction absente dans le bundle serverless : on n'invente rien.
      return;
    }

    // Les deux pilotes acceptent une requête à la fois : on découpe le script
    // en blocs (en respectant les corps `$$ … $$` des fonctions).
    const instructions = decouperBlocsSql(script);

    if (neonHttp) {
      // Neon HTTP : on rejoue seulement les blocs utiles, un par un.
      for (const bloc of decouperBlocsSql(script)) {
        await neonHttp.query(bloc, [] as never);
      }
    } else {
      const pool = obtenirPool();
      const client = await pool.connect();
      try {
        for (const instruction of instructions) await client.query(instruction);
      } finally {
        client.release();
      }
    }

    await executerBrut(
      `INSERT INTO parametres (cle, valeur, description)
       VALUES ('schema_version', $1, 'Version du schéma appliquée automatiquement')
       ON CONFLICT (cle) DO UPDATE SET valeur = $1`,
      [String(VERSION_SCHEMA)],
    );
    console.warn(`[db] migrations appliquées (version ${VERSION_SCHEMA}).`);
  } catch (e) {
    console.warn("[db] migrations non appliquées (on continue)", e);
  }
}

/** Découpe un script SQL en blocs terminés par `;` en dehors des `$$`. */
function decouperBlocsSql(script: string): string[] {
  const blocs: string[] = [];
  let courant = "";
  let dansDollar = false;
  const lignes = script.split("\n");
  for (const ligne of lignes) {
    const sansCommentaire = ligne.trimStart().startsWith("--") ? "" : ligne;
    courant += `${sansCommentaire}\n`;
    const occurrences = (sansCommentaire.match(/\$\$/g) ?? []).length;
    if (occurrences % 2 === 1) dansDollar = !dansDollar;
    if (!dansDollar && sansCommentaire.trimEnd().endsWith(";")) {
      const bloc = courant.trim();
      if (bloc && bloc !== ";") blocs.push(bloc);
      courant = "";
    }
  }
  if (courant.trim()) blocs.push(courant.trim());
  return blocs;
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
  await verifierSchema();
  return executerBrut(texte, parametres);
}

/* -------------------------------------------------------------------------- */
/*  Erreurs métier                                                             */
/* -------------------------------------------------------------------------- */

export type CodeErreurMetier =
  | "CADEAU_INDISPONIBLE"
  | "DEJA_PARTICIPE"
  | "NON_TROUVE"
  | "CONFLIT"
  | "BLOQUE"
  /** Le participant a déjà utilisé tous ses tours (vérifié en base). */
  | "TOURS_EPUISES"
  /** Aucun lot disponible : on refuse le tirage au lieu d'offrir une perte. */
  | "AUCUN_LOT";

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
  if (message.includes("TOURS_EPUISES")) {
    return new ErreurMetier(
      "Vous avez déjà utilisé tous vos tours. Partagez à un ami pour en gagner un de plus !",
      "TOURS_EPUISES",
    );
  }
  if (message.includes("PARTICIPANT_BLOQUE")) {
    return new ErreurMetier("Ce compte est bloqué.", "BLOQUE");
  }
  console.error("[db] erreur inattendue", e);
  return new ErreurMetier("Une erreur est survenue. Réessayez dans un instant.", "CONFLIT");
}

/**
 * État de la base, en lecture seule — utilisé par /api/sante après un
 * déploiement. Répond à une question précise : « les migrations sont-elles
 * réellement passées en production ? », sans avoir à gagner un cadeau pour
 * le savoir (ce qui modifierait le stock et les statistiques).
 *
 * On ne renvoie que des faits de schéma, aucun secret.
 */
export async function etatSchema(): Promise<{
  joignable: boolean;
  version: number;
  participantFacultatif: boolean | null;
  gainAnonymeAutorise: boolean | null;
}> {
  try {
    await sql`SELECT 1`;
    const [v] = await sql`
      SELECT COALESCE((SELECT valeur FROM parametres WHERE cle = 'schema_version'), '0') AS version
    `;
    const [colonne] = await sql`
      SELECT is_nullable
        FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tirages' AND column_name = 'participant_id'
    `;
    // Le garde-fou doit accepter un gain sans participant : on évalue la
    // définition de la contrainte, sans jamais écrire de tirage.
    const [contrainte] = await sql`
      SELECT pg_get_constraintdef(oid) AS def
        FROM pg_constraint
       WHERE conname = 'tirages_gain_coherent'
    `;
    return {
      joignable: true,
      version: Number((v as { version?: string }).version ?? 0),
      participantFacultatif:
        colonne === undefined ? null : (colonne as { is_nullable: string }).is_nullable === "YES",
      gainAnonymeAutorise: contrainte
        ? !/p_participant_id/.test((contrainte as { def: string }).def)
        : null,
    };
  } catch {
    return {
      joignable: false,
      version: 0,
      participantFacultatif: null,
      gainAnonymeAutorise: null,
    };
  }
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
