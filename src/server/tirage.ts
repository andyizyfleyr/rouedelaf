import "server-only";

import { randomInt } from "node:crypto";

import { ErreurMetier, sql, traduireErreur } from "@/lib/db";
import { construireCases } from "@/lib/roue";
import { tirerGagnant } from "@/lib/tirage-serveur";
import type { CadeauRoue, ResultatTirageApi } from "@/lib/types";

import { lireParametres } from "./params";

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  MOTEUR DE TIRAGE — 100 % SERVEUR
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Règles appliquées ici, dans cet ordre :
 *
 *  1. Le jeu doit être ouvert (`active_jeu`) et le participant non bloqué.
 *  2. Le participant doit avoir des tours restants (tours_max + bonus parrainage
 *     - tirages déjà effectués).
 *  3. On charge les lots actifs avec stock > 0.
 *  4. Le gagnant est choisi avec `crypto.randomInt` selon les poids, en
 *     ignorant les lots à stock 0.
 *  5. L'enregistrement est ATOMIQUE en base (fonction SQL `enregistrer_tirage`
 *     avec verrou FOR UPDATE) : si deux joueurs visent le dernier lot, l'un
 *     reçoit une erreur CADEAU_INDISPONIBLE et un nouveau tirage est tenté
 *     sans le lot épuisé.
 *  6. On renvoie au navigateur l'INDEX de la case à afficher : la roue
 *     s'arrêtera exactement sur le résultat déjà décidé.
 */

/** Nombre maximal de tentatives en cas de lot épuisé entre-temps. */
const TENTATIVES_MAX = 4;

type CadeauDb = {
  id: number;
  nom: string;
  description: string | null;
  image_url: string | null;
  stock: number;
  probabilite: string | number;
  couleur: string;
  icone: string;
  actif: boolean;
  ordre: number;
};

/** Charge les lots visibles sur la roue (actifs, ordonnés). */
export async function chargerCadeauxRoue(): Promise<CadeauDb[]> {
  const lignes = await sql`
    SELECT id, nom, description, image_url, stock, probabilite, couleur, icone, actif, ordre
    FROM cadeaux
    WHERE actif = true
    ORDER BY ordre ASC, id ASC
  `;
  return lignes as CadeauDb[];
}

/** Nombre de tirages déjà effectués par un participant. */
export async function compterTirages(participantId: number): Promise<number> {
  const [ligne] = await sql`
    SELECT count(*)::int AS n FROM tirages WHERE participant_id = ${participantId}
  `;
  return Number(ligne?.n ?? 0);
}

/** Tours restants (base + bonus - consommés). */
export async function toursRestants(participantId: number): Promise<number> {
  const parametres = await lireParametres();
  const [p] = await sql`
    SELECT tours_bonus, bloque FROM participants WHERE id = ${participantId}
  `;
  if (!p) throw new ErreurMetier("Participant introuvable", "NON_TROUVE");
  if (p.bloque) throw new ErreurMetier("Ce compte est bloqué.", "BLOQUE");

  const autorises = parametres.toursMax + Number(p.tours_bonus ?? 0);
  const utilises = await compterTirages(participantId);
  return Math.max(autorises - utilises, 0);
}

/**
 * Choisit un index de case sur la roue AFFICHÉE pour un cadeau donné.
 * La roue affichée est reconstruite avec `construireCases` — la même fonction
 * que le client — pour que l'index corresponde exactement à l'affichage.
 */
export function indexDeLaCase(
  cases: CadeauRoue[],
  cadeauId: number | null,
): number {
  if (cadeauId === null) {
    // Case perdante : on en prend une au hasard parmi celles affichées.
    const indicesPerdus = cases.map((c, i) => (c.id < 0 ? i : -1)).filter((i) => i >= 0);
    if (indicesPerdus.length === 0) return 0;
    return indicesPerdus[randomInt(indicesPerdus.length)];
  }
  const index = cases.findIndex((c) => c.id === cadeauId);
  return index >= 0 ? index : 0;
}

/**
 * Effectue un tirage complet pour un participant.
 *
 * @param participantId participant vérifié (session)
 * @param contexte      empreinte appareil / hash IP (anti-abus, journal)
 */
export async function effectuerTirage(
  participantId: number,
  contexte: { appareil: string | null; ipHash: string | null },
): Promise<ResultatTirageApi> {
  const parametres = await lireParametres();

  if (!parametres.activeJeu) {
    throw new ErreurMetier("Le jeu est momentanément fermé. Revenez bientôt !", "CONFLIT");
  }

  // 1) Droits à jouer
  const restants = await toursRestants(participantId);
  if (restants <= 0) {
    throw new ErreurMetier(
      "Vous avez déjà utilisé tous vos tours. Partagez à un ami pour en gagner un de plus !",
      "CONFLIT",
    );
  }

  // 2) Ce tirage est-il un tour BONUS (gagné via parrainage) ?
  //    Il l'est si le nombre de tours déjà consommés dépasse les tours de base
  //    offerts à chaque participant.
  const dejaJoues = await compterTirages(participantId);
  const estBonus = dejaJoues >= parametres.toursMax;

  const cadeaux = await chargerCadeauxRoue();
  const cases = construireCases(
    cadeaux.map((c) => ({
      id: Number(c.id),
      nom: c.nom,
      couleur: c.couleur,
      icone: c.icone,
      probabilite: Number(c.probabilite),
      stock: Number(c.stock),
    })),
  );

  // 3) Sélection cryptographique du lot, avec réessai si épuisement concurrent.
  let dernierEchec: unknown = null;

  for (let tentative = 0; tentative < TENTATIVES_MAX; tentative += 1) {
    const disponibles = cadeaux
      .filter((c) => Number(c.stock) > 0 && Number(c.probabilite) > 0)
      .map((c) => ({
        id: Number(c.id),
        nom: c.nom,
        probabilite: Number(c.probabilite),
        stock: Number(c.stock),
      }));

    const gagnant = tirerGagnant(disponibles);
    const cadeauId = gagnant?.id ?? null;

    try {
      // 4) Enregistrement atomique en base (verrou stock + code unique).
      const [resultat] = await sql`
        SELECT * FROM enregistrer_tirage(
          ${participantId},
          ${cadeauId}::bigint,
          ${parametres.dureeValiditeCodeJours}::integer,
          ${estBonus}::boolean,
          ${contexte.appareil}::text,
          ${contexte.ipHash}::text
        )
      `;

      const caseIndex = indexDeLaCase(cases, cadeauId);
      const cadeau = cadeaux.find((c) => Number(c.id) === cadeauId) ?? null;

      return {
        tirageId: Number(resultat.tirage_id),
        statut: resultat.statut === "gagne" ? "gagne" : "perdu",
        caseIndex,
        nombreCases: cases.length,
        cadeau: cadeau
          ? { id: Number(cadeau.id), nom: cadeau.nom, couleur: cadeau.couleur, icone: cadeau.icone }
          : null,
        code: resultat.code_unique ? String(resultat.code_unique) : null,
        expireLe: resultat.expire_le ? new Date(resultat.expire_le as string).toISOString() : null,
        reductionConsolation: resultat.statut === "perdu" ? parametres.reductionConsolation : null,
      };
    } catch (e) {
      const traduit = traduireErreur(e);
      if (traduit.code !== "CADEAU_INDISPONIBLE") throw traduit;
      // Le lot vient d'être épuisé par un autre joueur : on retire ce lot du
      // stock local et on retente immédiatement (sans afficher d'erreur).
      dernierEchec = e;
      const epuise = cadeaux.find((c) => Number(c.id) === cadeauId);
      if (epuise) epuise.stock = 0;
    }
  }

  console.warn("[tirage] lots épuisés en cascade", dernierEchec);
  throw new ErreurMetier(
    "Trop de joueurs en même temps, réessayez dans un instant.",
    "CONFLIT",
  );
}

/**
 * Sécurité complémentaire : si la somme des probabilités dépasse 100 %,
 * on garde la proportion relative (les chances de gagner deviennent 100 %).
 */
export function bornerProbabilites(
  disponibles: { id: number; probabilite: number }[],
): { id: number; probabilite: number }[] {
  const total = disponibles.reduce((s, c) => s + Math.max(c.probabilite, 0), 0);
  if (total <= 100) return disponibles;
  return disponibles.map((c) => ({ ...c, probabilite: (c.probabilite / total) * 100 }));
}
