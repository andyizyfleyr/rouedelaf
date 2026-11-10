import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { env } from "./env";

/**
 * Anti-abus (Upstash Redis).
 *
 * - Limite par IP (sliding window) sur les routes sensibles.
 * - Limite par appareil (empreinte navigateur) sur les tirages.
 * - Verrou « un seul tirage en cours » pour éviter le double-clic.
 *
 * Sans Upstash configuré (développement), tout est autorisé : l'application
 * reste utilisable en local, un avertissement est loggé une seule fois.
 */

let redis: Redis | null = null;
let avertissementFait = false;

function client(): Redis | null {
  if (redis) return redis;
  const conf = env.upstash;
  if (!conf) {
    if (!avertissementFait) {
      avertissementFait = true;
      console.warn(
        "[rate-limit] UPSTASH_REDIS_REST_URL / TOKEN absents : limitation des abus DÉSACTIVÉE (mode développement).",
      );
    }
    return null;
  }
  redis = new Redis({ url: conf.url, token: conf.token });
  return redis;
}

type Fenetre = "test" | "inscription" | "tirage" | "scan" | "admin";

const CONFIGS: Record<Fenetre, { requetes: number; duree: `${number} s` | `${number} m` | `${number} h` }> = {
  test: { requetes: 60, duree: "1 m" },
  inscription: { requetes: 5, duree: "10 m" }, // 5 inscriptions / 10 min / IP
  tirage: { requetes: 12, duree: "10 m" }, // 12 tirages / 10 min / IP (tours bonus inclus)
  scan: { requetes: 120, duree: "1 m" }, // scans admin : généreux
  admin: { requetes: 20, duree: "15 m" }, // tentatives de mot de passe
};

const limiteurs = new Map<Fenetre, Ratelimit>();

function limiteur(fenetre: Fenetre): Ratelimit | null {
  const r = client();
  if (!r) return null;
  const existant = limiteurs.get(fenetre);
  if (existant) return existant;
  const config = CONFIGS[fenetre];
  const nouveau = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(config.requetes, config.duree),
    prefix: `roue:${fenetre}`,
    analytics: false,
  });
  limiteurs.set(fenetre, nouveau);
  return nouveau;
}

export type ResultatLimite = {
  ok: boolean;
  restant: number;
  /** Secondes avant réessai (0 si ok). */
  retryAfter: number;
};

/**
 * Vérifie la limite pour un identifiant donné.
 * @param fenetre  catégorie de limitation
 * @param identifiant  IP, hash d'appareil, participant…
 */
export async function verifierLimite(
  fenetre: Fenetre,
  identifiant: string,
): Promise<ResultatLimite> {
  const rl = limiteur(fenetre);
  if (!rl) return { ok: true, restant: Infinity, retryAfter: 0 };

  try {
    const r = await rl.limit(identifiant);
    return {
      ok: r.success,
      restant: r.remaining,
      retryAfter: r.success ? 0 : Math.max(Math.ceil((r.reset - Date.now()) / 1000), 1),
    };
  } catch (e) {
    // Une panne Upstash ne doit pas bloquer les clients : on laisse passer
    // mais on logge (fail-open assumé, la vraie barrière reste la base).
    console.error("[rate-limit] échec Upstash", e);
    return { ok: true, restant: Infinity, retryAfter: 0 };
  }
}

/**
 * Verrou simple : empêche deux tirages simultanés pour le même participant
 * (double-clic, onglet dupliqué). TTL court, libéré automatiquement.
 */
export async function prendreVerrou(cle: string, secondes = 15): Promise<boolean> {
  const r = client();
  if (!r) return true;
  try {
    const res = await r.set(`roue:lock:${cle}`, "1", { nx: true, ex: secondes });
    return res === "OK";
  } catch {
    return true;
  }
}

export async function libererVerrou(cle: string): Promise<void> {
  const r = client();
  if (!r) return;
  try {
    await r.del(`roue:lock:${cle}`);
  } catch {
    /* silencieux */
  }
}


/* -------------------------------------------------------------------------- */
/*  Diagnostic                                                                 */
/* -------------------------------------------------------------------------- */

/** Upstash est-il configuré ? (sert à /api/admin/diagnostic et aux journaux) */
export function limitationActive(): boolean {
  return env.upstash !== null;
}

/**
 * Vérifie que l'anti-abus est réellement opérationnel, sans consommer le quota
 * d'une vraie fenêtre : on utilise une fenêtre dédiée et une clé unique.
 *
 * Renvoie un compte rendu lisible plutôt qu'un simple booléen : en cas de
 * panne, l'admin doit savoir s'il s'agit d'une variable absente, d'un jeton
 * révoqué ou d'un réseau bloqué.
 */
export async function verifierAntiAbus(): Promise<{
  configure: boolean;
  operationnel: boolean;
  message: string;
  variables: { url: boolean; token: boolean };
}> {
  const url = Boolean(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
  const token = Boolean(
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
  );
  const variables = { url, token };

  if (!url || !token) {
    return {
      configure: false,
      operationnel: false,
      variables,
      message:
        "Upstash non configuré : la limitation par IP/appareil est DÉSACTIVÉE. Ajoutez UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN dans Vercel, puis redéployez.",
    };
  }

  const r = client();
  if (!r) {
    return {
      configure: true,
      operationnel: false,
      variables,
      message: "Variables présentes mais client non initialisé.",
    };
  }

  try {
    // Écriture éphémère : prouve l'authentification ET la connectivité.
    const cle = `roue:diagnostic:${Date.now()}`;
    await r.set(cle, "ok", { ex: 30 });
    const valeur = await r.get(cle);
    await r.del(cle);

    if (valeur !== "ok") {
      return {
        configure: true,
        operationnel: false,
        variables,
        message: "Écriture acceptée mais relecture différente : vérifiez la base Upstash.",
      };
    }

    return {
      configure: true,
      operationnel: true,
      variables,
      message: "Anti-abus actif : les limites par IP et par appareil sont appliquées.",
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return {
      configure: true,
      operationnel: false,
      variables,
      message: `Upstash injoignable ou jeton invalide : ${detail.slice(0, 160)}`,
    };
  }
}
