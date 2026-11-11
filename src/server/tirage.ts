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
 *  1. Le jeu doit être ouvert (`active_jeu`).
 *  2. Aucune limite de tours : le poste de la boutique doit pouvoir enchaîner
 *     les clients (la limite réelle, c'est le stock).
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
 * Effectue un tirage complet.
 *
 * Le jeu tourne sur le POSTE DE LA BOUTIQUE : le client ne s'inscrit pas, ne
 * saisit ni nom ni numéro, et peut jouer autant de fois qu'il veut. Un tirage
 * n'est donc rattaché à aucun participant (`participant_id = NULL`), et la
 * seule limite est le stock des cadeaux.
 *
 * Conséquence assumée par l'exploitant : il n'y a plus de « un tour par
 * numéro ». La vendeuse garde la main via le réglage « Jeu ouvert » et le
 * stock de chaque lot.
 *
 * @param contexte empreinte appareil / hash IP (anti-abus, journal)
 */
export async function effectuerTirage(contexte: {
  appareil: string | null;
  ipHash: string | null;
}): Promise<ResultatTirageApi> {
  const parametres = await lireParametres();

  if (!parametres.activeJeu) {
    throw new ErreurMetier("Le jeu est momentanément fermé. Revenez bientôt !", "CONFLIT");
  }

  const cadeaux = await chargerCadeauxRoue();
  const cases = construireCases(
    cadeaux.map((c) => ({
      id: Number(c.id),
      nom: c.nom,
      couleur: c.couleur,
      icone: c.icone,
      probabilite: Number(c.probabilite),
      stock: Number(c.stock),
      image_url: c.image_url,
    })),
    parametres.nombreCases,
  );

  // 2 bis) AUCUN LOT DISPONIBLE → on refuse le tirage.
  //    Avant, la roue s'affichait avec des cases « Perdu » et le joueur
  //    consommait son tour pour rien, alors que l'accroche promet un cadeau.
  //    On préfère un message clair et NE PAS consommer de tour.
  const lotsDisponibles = cadeaux.filter(
    (c) => Number(c.stock) > 0 && Number(c.probabilite) > 0,
  );
  if (lotsDisponibles.length === 0) {
    throw new ErreurMetier(
      "Tous les cadeaux ont été gagnés ! Revenez demain, la boutique recharge la roue.",
      "AUCUN_LOT",
    );
  }

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
          ${null}::bigint,
          ${cadeauId}::bigint,
          ${parametres.dureeValiditeCodeJours}::integer,
          false::boolean,
          ${contexte.appareil}::text,
          ${contexte.ipHash}::text
        )
      `;

      const caseIndex = indexDeLaCase(cases, cadeauId);
      const cadeau = cadeaux.find((c) => Number(c.id) === cadeauId) ?? null;

      // Le code de retrait et son QR ne sont plus affichés au client : la
      // popup ne montre que « Félicitations » et le cadeau, et la remise se
      // fait à la caisse. On cesse donc de les générer pour un tirage anonyme
      // (une image de QR coûtait ~50 ms de CPU par tour sur le poste).
      const codeUnique = resultat.code_unique ? String(resultat.code_unique) : null;

      return {
        tirageId: Number(resultat.tirage_id),
        statut: resultat.statut === "gagne" ? "gagne" : "perdu",
        caseIndex,
        nombreCases: cases.length,
        cadeau: cadeau
          ? {
              id: Number(cadeau.id),
              nom: cadeau.nom,
              couleur: cadeau.couleur,
              icone: cadeau.icone,
              image_url: cadeau.image_url,
            }
          : null,
        code: codeUnique,
        qrDataUrl: null,
        expireLe: resultat.expire_le ? new Date(resultat.expire_le as string).toISOString() : null,
        reductionConsolation: resultat.statut === "perdu" ? parametres.reductionConsolation : null,
      };
    } catch (e) {
      const traduit = traduireErreur(e);
      // La base a refusé : soit le lot vient d'être épuisé (on retente), soit
      // le jeu vient d'être fermé depuis l'administration : dans ces cas on
      // remonte l'erreur telle quelle.
      if (traduit.code !== "CADEAU_INDISPONIBLE") throw traduit;
      // Le lot vient d'être épuisé : on retire ce lot du stock local et on
      // retente immédiatement (sans afficher d'erreur).
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
