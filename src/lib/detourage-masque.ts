/**
 * Masque de détourage des photos de produit — module PUR.
 *
 * Séparé de `src/server/detourage.ts` (qui, lui, dépend de sharp et ne
 * s'exécute que sur le serveur) pour deux raisons :
 *  • les tests peuvent l'exercer sans navigateur ni bibliothèque native ;
 *  • c'est ici que se prennent les décisions délicates — ce qu'est « le
 *    fond », jusqu'où le remplissage peut s'aventurer — et elles méritent
 *    d'être couvertes.
 */

/** Écart maximal à la couleur de fond pour un pixel « fond ». */
export const TOLERANCE = 22;

/** Écart de contour au-delà duquel on ne traverse plus (garde-fou). */
export const CONTOUR = 18;

/** Écart toléré pour considérer le liseré comme uni (photo studio). */
export const UNI_MAX = 12;

/** Part de l'image que le détourage doit retirer pour valoir la peine. */
export const GAIN_MIN = 0.08;

/**
 * Part maximale de l'image qui peut disparaître.
 *
 * Au-delà, il ne reste RIEN : le remplissage a traversé toute la photo. C'est
 * ce qui arrive sur une image uniforme (un fond seul), ou quand le produit
 * est de la même couleur que le fond sans contour pour l'arrêter. Mieux vaut
 * refuser le détourage que servir une case vide.
 */
export const RETRAIT_MAX = 0.985;

/**
 * Calcule le masque de transparence d'une image RGBA.
 *
 * Fonction PURE (aucune dépendance à sharp ni au DOM) : c'est elle que les
 * tests couvrent, et c'est elle qui portait les décisions délicates.
 *
 * @param rgba pixels RGBA (4 octets par pixel, ligne par ligne)
 * @param largeur largeur en pixels
 * @param hauteur hauteur en pixels
 * @returns un alpha par pixel (0 ou 255, bord adouci), ou null si le fond
 *          n'est pas exploitable (non uni, produit collé au bord, etc.)
 */
export function masqueFond(
  rgba: Uint8Array | Buffer,
  largeur: number,
  hauteur: number,
): { alpha: Uint8Array; retrait: number } | null {
  const total = largeur * hauteur;
  if (total === 0) return null;

  // ── 1. Couleur du fond = moyenne du liseré extérieur. ───────────────────
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  const bords: number[] = [];
  for (let x = 0; x < largeur; x += 1) {
    bords.push(x, largeur - 1 - x === x ? x : (hauteur - 1) * largeur + x);
    n += 2;
  }
  for (let y = 0; y < hauteur; y += 1) {
    bords.push(y * largeur, y * largeur + largeur - 1);
    n += 2;
  }
  for (const p of bords) {
    sr += rgba[p * 4];
    sg += rgba[p * 4 + 1];
    sb += rgba[p * 4 + 2];
  }
  const fr = sr / n;
  const fg = sg / n;
  const fb = sb / n;

  // Le liseré doit être homogène : sinon c'est une photo d'ambiance.
  let ecart = 0;
  for (const p of bords) {
    ecart +=
      Math.abs(rgba[p * 4] - fr) +
      Math.abs(rgba[p * 4 + 1] - fg) +
      Math.abs(rgba[p * 4 + 2] - fb);
  }
  ecart /= n * 3;
  if (ecart > UNI_MAX) return null;

  // ── 2. Carte « pixel proche du fond » et carte « contour ». ─────────────
  const distance = new Uint8Array(total); // 0 = loin du fond, 255 = fond
  const proche = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) {
    const d =
      Math.abs(rgba[i * 4] - fr) +
      Math.abs(rgba[i * 4 + 1] - fg) +
      Math.abs(rgba[i * 4 + 2] - fb);
    distance[i] = Math.min(255, d);
    proche[i] = d <= TOLERANCE * 3 ? 1 : 0;
  }

  // Contour : écart marqué avec le voisin de droite ou du dessous. Il empêche
  // le remplissage de « fuir » à travers une arête du produit.
  const contour = new Uint8Array(total);
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const i = y * largeur + x;
      if (x + 1 < largeur) {
        const j = i + 1;
        const e = Math.max(
          Math.abs(rgba[i * 4] - rgba[j * 4]),
          Math.abs(rgba[i * 4 + 1] - rgba[j * 4 + 1]),
          Math.abs(rgba[i * 4 + 2] - rgba[j * 4 + 2]),
        );
        if (e > CONTOUR) contour[i] = 1;
      }
      if (y + 1 < hauteur) {
        const j = i + largeur;
        const e = Math.max(
          Math.abs(rgba[i * 4] - rgba[j * 4]),
          Math.abs(rgba[i * 4 + 1] - rgba[j * 4 + 1]),
          Math.abs(rgba[i * 4 + 2] - rgba[j * 4 + 2]),
        );
        if (e > CONTOUR) contour[i] = 1;
      }
    }
  }

  // ── 3. Remplissage depuis les bords (file, pour éviter la récursion). ────
  const fond = new Uint8Array(total); // 1 = fond atteint
  const file = new Int32Array(total);
  let debut = 0;
  let fin = 0;

  const empiler = (i: number) => {
    if (fond[i] || !proche[i] || contour[i]) return;
    fond[i] = 1;
    file[fin++] = i;
  };
  for (let x = 0; x < largeur; x += 1) {
    empiler(x);
    empiler((hauteur - 1) * largeur + x);
  }
  for (let y = 0; y < hauteur; y += 1) {
    empiler(y * largeur);
    empiler(y * largeur + largeur - 1);
  }

  while (debut < fin) {
    const i = file[debut++];
    const x = i % largeur;
    const y = (i - x) / largeur;
    if (x > 0) empiler(i - 1);
    if (x + 1 < largeur) empiler(i + 1);
    if (y > 0) empiler(i - largeur);
    if (y + 1 < hauteur) empiler(i + largeur);
  }

  let atteints = 0;
  for (let i = 0; i < total; i += 1) atteints += fond[i];
  const retrait = atteints / total;
  if (retrait < GAIN_MIN) return null;
  // Tout est devenu transparent : le détourage a « mangé » l'image entière.
  if (retrait > RETRAIT_MAX) return null;

  // ── 4. Alpha : 0 dans le fond, 255 sur le produit, adouci au contact. ────
  const alpha = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) alpha[i] = fond[i] ? 0 : 255;

  // Bord : un pixel de produit qui touche le fond reçoit un alpha
  // proportionnel à sa distance à la couleur de fond (anti-escalier).
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const i = y * largeur + x;
      if (fond[i]) continue;
      const voisinFond =
        (x > 0 && fond[i - 1]) ||
        (x + 1 < largeur && fond[i + 1]) ||
        (y > 0 && fond[i - largeur]) ||
        (y + 1 < hauteur && fond[i + largeur]);
      if (!voisinFond) continue;
      // Un pixel de produit qui frôle le fond est en réalité un pixel de
      // CONTOUR (l'antialiasing du studio, la fumée du détourage d'origine).
      // On le rend franchement plus opaque que transparent : un bord net se
      // lit « haute résolution », un bord translucide se lit « découpé à
      // l'arrache ». `distance` vaut au moins TOLERANCE ici, d'où le +80.
      const t = (distance[i] - TOLERANCE + 80) / (TOLERANCE * 2);
      alpha[i] = Math.max(0, Math.min(255, Math.round(t * 255)));
    }
  }

  return { alpha, retrait };
}
