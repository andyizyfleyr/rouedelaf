import "server-only";

import sharp from "sharp";

/**
 * Détourage des photos de produit : fond uni → transparence.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  POURQUOI
 * ══════════════════════════════════════════════════════════════════════════
 * Les photos d'exploitant arrivent presque toujours en « packshot » : le
 * produit posé sur du blanc. Collées dans une case de roue, elles formaient
 * un rectangle blanc — une vignette de catalogue, pas un objet.
 *
 * On retire donc le fond studio et l'on ne garde que le produit, en PNG
 * transparent. Le produit se pose directement sur le velours de la case,
 * comme sur une vitrine. Et comme l'image est rognée sur le produit (puis
 * légèrement remise à l'échelle), il occupe sa case au maximum.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  COMMENT
 * ══════════════════════════════════════════════════════════════════════════
 *  1. On échantillonne le liseré de l'image : c'est la couleur du fond.
 *  2. On « remplit » depuis les bords, en ne traversant que les pixels
 *     proches de cette couleur ET sans contour marqué. Le garde-fou de
 *     contour est essentiel : sans lui, un produit blanc sur fond blanc
 *     (balance, pH-mètre) serait entièrement avalé.
 *  3. Les pixels atteints deviennent transparents, le bord est adouci pour
 *     éviter l'escalier.
 *  4. On rogne sur le produit, on ajoute 2 % de respiration, on réduit à
 *     600 px et on exporte en PNG.
 *
 * ⚠️ Refus explicites — mieux vaut une photo avec son fond qu'un produit
 * massacré :
 *  • fond non uni (photo d'ambiance, atelier, dégradé) ;
 *  • produit qui touche le bord (le remplissage ne saurait pas où s'arrêter) ;
 *  • détourage qui ne retire presque rien (moins de 8 % de l'image).
 * Dans ces cas on renvoie `null` et l'appelant sert l'image d'origine.
 */

import { masqueFond } from "@/lib/detourage-masque";

/** Résolution d'analyse : assez fine pour les mèches et les câbles. */
const ANALYSE = 900;

/** Taille du PNG produit (le plus grand côté), en pixels. */
const SORTIE = 600;

export type Detourage = {
  png: Buffer;
  /** Part de l'image devenue transparente (0 → 1), pour le diagnostic. */
  retrait: number;
};

/**
 * Détoure une image (boîte englobante du produit, fond transparent, PNG).
 * Renvoie null si le détourage n'est pas pertinent — l'appelant sert alors
 * l'originale.
 */
export async function detourer(donnees: Buffer): Promise<Detourage | null> {
  try {
    // `rotate()` sans argument applique l'EXIF : une photo de téléphone prise
    // « debout » ne doit pas être détourée couchée.
    const base = sharp(donnees, { failOn: "none" }).rotate();

    const { data, info } = await base
      .resize({
        width: ANALYSE,
        height: ANALYSE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const masque = masqueFond(data, info.width, info.height);
    if (!masque) return null;

    // On applique l'alpha sur une copie : le RGB reste celui de l'original.
    const rgba = Buffer.from(data);
    for (let i = 0; i < masque.alpha.length; i += 1)
      rgba[i * 4 + 3] = masque.alpha[i];

    // Boîte englobante du produit, avec 2 % de respiration.
    let x0 = info.width;
    let y0 = info.height;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        if (masque.alpha[y * info.width + x] < 16) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (x1 < x0 || y1 < y0) return null;

    const margeX = Math.round((x1 - x0 + 1) * 0.02);
    const margeY = Math.round((y1 - y0 + 1) * 0.02);
    const gauche = Math.max(0, x0 - margeX);
    const haut = Math.max(0, y0 - margeY);
    const largeur = Math.min(info.width - gauche, x1 - x0 + 1 + 2 * margeX);
    const hauteur = Math.min(info.height - haut, y1 - y0 + 1 + 2 * margeY);

    // Rogner d'abord, puis réduire : on garde toute la définition du produit
    // au lieu de diluer les détails dans une réduction globale.
    const png = await sharp(rgba, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .extract({ left: gauche, top: haut, width: largeur, height: hauteur })
      .resize({
        width: SORTIE,
        height: SORTIE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9, effort: 7, palette: false })
      .toBuffer();

    return { png, retrait: masque.retrait };
  } catch (e) {
    console.error("[detourage] échec", e);
    return null;
  }
}
