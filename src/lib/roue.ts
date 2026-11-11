/**
 * Géométrie de la roue — module partagé client/serveur, sans aucune logique
 * de hasard.
 *
 * ⚠️ La décision du gagnant est prise UNIQUEMENT côté serveur dans
 * `src/server/tirage.ts` (crypto.randomInt). Ce fichier ne fait que calculer
 * les secteurs et l'angle d'arrêt annoncé par le serveur.
 */

import type { CadeauRoue } from "./types";

/** Nombre minimal de cases pour une roue agréable à regarder. */
export const CASES_MIN = 8;

/**
 * Nombre de cases de la roue, réglable par l'exploitant (`parametres.nb_cases`).
 *
 * Pourquoi un réglage et plus une constante : le nombre de lots change (soldes,
 * arrivages), et une roue figée à 8 se remplissait de cases « Perdu » inutiles
 * dès que le catalogue grandissait — ou forçait à créer des lots fantômes pour
 * l'étoffer. Bornes : 4 (en dessous, les secteurs sont énormes et le texte
 * géant) à 32 (au-delà, un secteur ne fait plus que 11° : les libellés
 * deviennent illisibles sur un téléphone).
 */
export const CASES_DEFAUT = 8;
export const CASES_MIN_REGLABLE = 4;
export const CASES_MAX = 32;

/** Ramène une valeur quelconque dans les bornes, par pas de 2 (roue paire). */
export function normaliserNombreCases(valeur: number | null | undefined): number {
  const n = Number(valeur);
  if (!Number.isFinite(n)) return CASES_DEFAUT;
  const pair = Math.round(n / 2) * 2;
  return Math.min(CASES_MAX, Math.max(CASES_MIN_REGLABLE, pair));
}

/**
 * Case « perdante » affichée sur la roue. Elle n'existe PAS dans la table
 * cadeaux : un tirage perdant est enregistré avec cadeau_id = NULL.
 * Les identifiants négatifs servent uniquement de clés React.
 */
export const CASE_PERDUE: CadeauRoue = {
  id: -1,
  nom: "Perdu",
  // Bordeaux presque noir : sur une table de jeu, la case « pas de cadeau »
  // doit s'effacer derrière les lots colorés tout en restant lisible.
  couleur: "#5C0A16",
  // L'emoji n'est jamais affiché sur la roue (rendu inégal selon les
  // téléphones, souvent un carré vide) : l'icône vient de IconeCadeau.
  icone: "",
  probabilite: 0,
  stock: 0,
};

/* --------------------------------------------------------------------------
 * PARTIE CLIENT — géométrie et construction de la roue
 * -------------------------------------------------------------------------- */

/**
 * Construit la liste des cases affichées.
 * - On part des lots actifs.
 * - On complète avec des cases « Perdu » jusqu'au nombre de cases voulu
 *   (`nombreCases`, réglable dans l'admin).
 * - On garantit un nombre PAIR de cases : deux cases diamétralement opposées
 *   ont alors des secteurs de même taille, donc toujours des centres distincts
 *   et sans ambiguïté pour l'aiguille (pas de superposition à 180°).
 */
/**
 * Ordonne les lots pour qu'aucune couleur ne se répète d'une case à l'autre.
 *
 * Sans cela, deux bordeaux voisins se lisaient comme une seule grande case :
 * l'exploitant croyait à un bug d'affichage. On prend toujours, après une
 * case, un lot d'une AUTRE couleur ; s'il n'en reste plus, on continue avec
 * la même (le liseré or et le bord assombri prennent alors le relais).
 *
 * L'ordre d'origine est conservé quand il alterne déjà : c'est lui qui porte
 * l'intention de l'exploitant (gros lot en haut, etc.).
 */
function alternerCouleurs(lots: CadeauRoue[]): CadeauRoue[] {
  const restants = [...lots];
  const ordonnes: CadeauRoue[] = [];
  while (restants.length > 0) {
    const precedente = ordonnes[ordonnes.length - 1]?.couleur?.toLowerCase();
    const different = restants.findIndex((c) => c.couleur.toLowerCase() !== precedente);
    ordonnes.push(...restants.splice(different === -1 ? 0 : different, 1));
  }
  return ordonnes;
}

export function construireCases(
  cadeaux: CadeauRoue[],
  nombreCases: number = CASES_DEFAUT,
): CadeauRoue[] {
  const lots = alternerCouleurs(cadeaux.filter((c) => c.probabilite > 0).map((c) => ({ ...c })));
  const voulu = normaliserNombreCases(nombreCases);

  if (lots.length === 0) {
    // Aucun lot : la roue ne sert à rien, mais elle doit rester géométriquement
    // valide (cela n'arrive plus en pratique : le serveur refuse le tirage).
    return Array.from({ length: voulu }, (_, i) => ({ ...CASE_PERDUE, id: -1 - i }));
  }

  // Objectif : le nombre de cases réglé, et un nombre PAIR (deux cases
  // diamétralement opposées ont alors des secteurs de même taille, donc des
  // centres distincts : l'aiguille ne peut pas hésiter entre deux cases).
  // Si le catalogue est plus fourni que le réglage, on affiche tous les lots :
  // jamais de lot invisible, donc jamais de cadeau impossible à gagner.
  const total = Math.max(voulu, lots.length + (lots.length % 2 === 0 ? 0 : 1));
  const cible = total % 2 === 0 ? total : total + 1;
  const perdus = Math.max(cible - lots.length, 0);

  // Répartition : on place les lots régulièrement sur le cercle et on glisse
  // les « Perdu » dans les trous. Avec p <= lots, ils ne se touchent JAMAIS
  // (avant, 6 lots donnaient 5 paires de « Perdu » collées : la roue semblait
  // cassée). Au-delà, des paires sont inévitables, mais restent minoritaires.
  const cases: CadeauRoue[] = [];
  let indexPerdu = 0;
  for (let i = 0; i < cible; i += 1) {
    const positionLot = Math.floor((i * lots.length) / cible);
    const estLot = Math.floor(((i + 1) * lots.length) / cible) > positionLot;
    if (estLot || indexPerdu >= perdus) {
      cases.push(lots[positionLot] ?? { ...CASE_PERDUE, id: -1 - indexPerdu++ });
    } else {
      // id unique négatif pour la clé React
      cases.push({ ...CASE_PERDUE, id: -1 - indexPerdu++ });
    }
  }

  return cases;
}

/** Angle (degrés) occupé par chaque case. */
export function angleParCase(nombreCases: number): number {
  return 360 / nombreCases;
}

/**
 * Angle final de la roue pour que le CENTRE de la case `index` s'aligne sous
 * l'aiguille (placée en haut, à -90° en coordonnées SVG).
 *
 * On part de la convention : la case 0 commence à 0° et occupe [0°, angle[.
 * La rotation est ensuite multiple de 360° + plusieurs tours complets.
 *
 * `derive` (entre -1 et 1) décale l'arrêt à l'intérieur du secteur : la roue
 * ne s'immobilise pas toujours au même endroit, ce qui rend le résultat plus
 * crédible. La valeur reste dans le secteur, donc l'aiguille désigne toujours
 * la bonne case.
 */
export function angleCible(
  index: number,
  nombreCases: number,
  tours: number,
  derive = 0,
): number {
  const secteur = angleParCase(nombreCases);
  // Marge de 18 % de chaque côté : l'aiguille ne touche jamais la séparation.
  const amplitude = secteur * 0.32;
  const centreCase = index * secteur + secteur / 2 + derive * amplitude;
  // La roue tourne dans le sens horaire : pour amener le centre de la case
  // sous l'aiguille (en haut), on tourne de -centreCase (modulo 360).
  const cible = (360 - centreCase) % 360;
  return tours * 360 + cible;
}

/**
 * Éclaircit (facteur > 1) ou assombrit (facteur < 1) une couleur hexadécimale.
 * Sert à créer les rayures claires/sombres d'un même secteur : la roue paraît
 * vernie au lieu d'être un simple camembert de couleurs unies.
 */
export function nuancer(hex: string, facteur: number): string {
  const propre = hex.replace("#", "");
  const complet =
    propre.length === 3
      ? propre
          .split("")
          .map((c) => c + c)
          .join("")
      : propre;
  const canal = (i: number) => {
    const v = parseInt(complet.slice(i, i + 2), 16);
    if (Number.isNaN(v)) return 128;
    return Math.max(0, Math.min(255, Math.round(v * facteur)));
  };
  return `#${[0, 2, 4].map((i) => canal(i).toString(16).padStart(2, "0")).join("")}`;
}

/** Couleur lisible (blanc/noir) sur un fond hexadécimal donné. */
export function couleurTexteSur(hex: string): string {
  const propre = hex.replace("#", "");
  const r = parseInt(propre.slice(0, 2), 16);
  const g = parseInt(propre.slice(2, 4), 16);
  const b = parseInt(propre.slice(4, 6), 16);
  // Luminance perçue (formule YIQ).
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance > 150 ? "#151210" : "#FFF8E7";
}

/** Description d'un secteur SVG (chemin d'arc). */
export function cheminSecteur(
  cx: number,
  cy: number,
  rayon: number,
  debutDeg: number,
  finDeg: number,
): string {
  const debut = pointSurCercle(cx, cy, rayon, debutDeg);
  const fin = pointSurCercle(cx, cy, rayon, finDeg);
  const grandArc = finDeg - debutDeg > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${debut.x} ${debut.y}`,
    `A ${rayon} ${rayon} 0 ${grandArc} 1 ${fin.x} ${fin.y}`,
    "Z",
  ].join(" ");
}

function pointSurCercle(cx: number, cy: number, rayon: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return {
    x: Number((cx + rayon * Math.cos(rad)).toFixed(3)),
    y: Number((cy + rayon * Math.sin(rad)).toFixed(3)),
  };
}
