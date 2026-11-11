"use client";

/**
 * Détourage automatique des photos de produit.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  POURQUOI CE FICHIER EXISTE
 * ══════════════════════════════════════════════════════════════════════════
 * Les photos envoyées par les boutiques viennent presque toujours d'un
 * téléphone ou d'un site fournisseur : carrées, avec d'énormes marges
 * blanches autour du produit. Le pH-mètre fourni par l'exploitant occupe
 * 30 % de la largeur de son image et 85 % de sa hauteur.
 *
 * Dans une case de roue — un secteur étroit qui va en s'élargissant — une
 * telle photo, affichée telle quelle, ne laisse voir qu'un objet minuscule.
 * On mesure donc, une seule fois par image, la boîte englobante du produit
 * (tout ce qui n'est pas le fond), et la roue n'affiche QUE cette boîte.
 * Le produit paraît deux à trois fois plus grand, et il reste entier.
 *
 * ⚠️ On ne recadre que si le fond est franchement UNI (bord blanc, gris
 * clair, ou transparent). Une photo d'ambiance — un atelier, un mur, un
 * dégradé — n'est jamais rognée : mieux vaut une photo un peu petite qu'un
 * produit coupé au hasard.
 *
 * Le calcul est fait dans un canvas du navigateur : aucun envoi au serveur,
 * aucune dépendance, et le résultat est mis en cache par URL (la roue
 * redessine ses cases à chaque rendu, on ne relit pas les pixels à chaque
 * fois).
 */

/** Boîte englobante du produit, en PIXELS de l'image d'origine. */
export type Cadre = {
  bx: number;
  by: number;
  bw: number;
  bh: number;
  /** Taille naturelle, nécessaire pour dessiner l'image dans le bon repère. */
  largeur: number;
  hauteur: number;
  /** Fond transparent : le produit doit flotter sur la case, sans carte blanche. */
  transparent: boolean;
};

/** Un seul calcul par URL, partagé par toutes les roues de la page. */
const cache = new Map<string, Promise<Cadre | null>>();

export function cadreProduit(url: string): Promise<Cadre | null> {
  const connu = cache.get(url);
  if (connu) return connu;
  const calcul = detecter(url).catch(() => null);
  cache.set(url, calcul);
  return calcul;
}

/** Résolution d'analyse : au-delà, on paie des millisecondes pour rien. */
const ECHANTILLON = 240;

/** Écart au fond toléré pour considérer un pixel comme « produit ». */
const SEUIL = 26;

/** Fond considéré comme uni si l'écart-type des canaux reste sous ce seuil. */
const UNI_MAX = 14;

/** Part de l'image que le cadrage doit retirer pour valoir la peine. */
const GAIN_MIN = 0.06;

/**
 * Mesure PURE (aucun DOM) : à partir des pixels RGBA d'une vignette, renvoie
 * la boîte englobante du produit et indique si le fond est transparent.
 *
 * Extraite du parcours canvas pour deux raisons :
 *  • elle est testable sans navigateur (voir tests/recadrage.test.ts) ;
 *  • c'est ici que se trouvait le bug : la condition « ce pixel est-il du
 *    fond ? » était INVERSEE pour les PNG transparents, si bien que l'alpha
 *    (le fond) était pris pour du produit et le produit pour du fond.
 *
 * Renvoie null quand il n'y a rien à cadrer : fond non uni (photo
 * d'ambiance), image entièrement uniforme, ou cadrage sans intérêt.
 *
 * @param pixels données RGBA (canvas.getImageData().data)
 * @param cl largeur analysée, en pixels
 * @param ch hauteur analysée, en pixels
 */
export function analyserPixels(
  pixels: Uint8ClampedArray | Uint8Array,
  cl: number,
  ch: number,
): {
  transparent: boolean;
  bx: number;
  by: number;
  bw: number;
  bh: number;
} | null {
  const at = (x: number, y: number) => (y * cl + x) * 4;

  // ── 1. Le fond est-il uni ? On échantillonne le liseré extérieur. ────────
  let n = 0;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let sa = 0;
  const bords: number[] = [];
  for (let x = 0; x < cl; x += 1) {
    for (const y of [0, 1, ch - 2, ch - 1]) {
      const i = at(x, y);
      bords.push(i);
      sr += pixels[i];
      sg += pixels[i + 1];
      sb += pixels[i + 2];
      sa += pixels[i + 3];
      n += 1;
    }
  }
  for (let y = 0; y < ch; y += 1) {
    for (const x of [0, 1, cl - 2, cl - 1]) {
      const i = at(x, y);
      bords.push(i);
      sr += pixels[i];
      sg += pixels[i + 1];
      sb += pixels[i + 2];
      sa += pixels[i + 3];
      n += 1;
    }
  }
  if (n === 0) return null;

  const mr = sr / n;
  const mg = sg / n;
  const mb = sb / n;
  const ma = sa / n;

  let ecart = 0;
  for (const i of bords) {
    ecart +=
      Math.abs(pixels[i] - mr) +
      Math.abs(pixels[i + 1] - mg) +
      Math.abs(pixels[i + 2] - mb);
  }
  ecart /= n * 3;

  const transparent = ma < 24;
  // Fond non uni : photo d'ambiance, on ne rogne rien.
  if (!transparent && ecart > UNI_MAX) return null;

  // ── 2. Boîte englobante du produit. ─────────────────────────────────────
  let x0 = cl;
  let y0 = ch;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < ch; y += 1) {
    for (let x = 0; x < cl; x += 1) {
      const i = at(x, y);
      // « fond » = pixel à ignorer. Attention au sens : sur un PNG transparent,
      // c'est l'ALPHA faible qui désigne le fond ; sur une photo opaque, c'est
      // l'écart au fond uni qui désigne le produit (donc l'inverse).
      const estFond = transparent
        ? pixels[i + 3] < 40
        : Math.abs(pixels[i] - mr) +
            Math.abs(pixels[i + 1] - mg) +
            Math.abs(pixels[i + 2] - mb) <=
          SEUIL * 3;
      if (estFond) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0 || y1 < 0) return null; // image uniforme : rien à cadrer

  // Marge de respiration : 2,5 % de la taille cadrée, pour ne pas coller le
  // produit au bord de la carte (un objet « bord à bord » paraît étouffé).
  const margeX = (x1 - x0 + 1) * 0.025;
  const margeY = (y1 - y0 + 1) * 0.025;

  return {
    transparent,
    bx: Math.max(0, x0 - margeX),
    by: Math.max(0, y0 - margeY),
    bw: x1 - x0 + 1 + 2 * margeX,
    bh: y1 - y0 + 1 + 2 * margeY,
  };
}

function charger(url: string): Promise<HTMLImageElement> {
  return new Promise((resoudre, rejeter) => {
    const img = new Image();
    // Pas de crossOrigin : les images de la boutique sont servies par notre
    // propre /api/image (même origine). Sur une URL externe qui refuserait
    // le CORS, la lecture du canvas échouera et on retombera proprement sur
    // la photo entière (voir le try/catch de `detecter`).
    img.onload = () => resoudre(img);
    img.onerror = () => rejeter(new Error("image illisible"));
    img.src = url;
  });
}

async function detecter(url: string): Promise<Cadre | null> {
  const img = await charger(url);
  const largeur = img.naturalWidth;
  const hauteur = img.naturalHeight;
  if (!largeur || !hauteur) return null;

  const k = Math.min(1, ECHANTILLON / Math.max(largeur, hauteur));
  const cl = Math.max(2, Math.round(largeur * k));
  const ch = Math.max(2, Math.round(hauteur * k));

  const toile = document.createElement("canvas");
  toile.width = cl;
  toile.height = ch;
  const ctx = toile.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, cl, ch);

  let pixels: Uint8ClampedArray;
  try {
    pixels = ctx.getImageData(0, 0, cl, ch).data;
  } catch {
    // Canvas « tainted » (image externe sans en-tête CORS) : on n'y touche pas.
    return null;
  }

  const mesure = analyserPixels(pixels, cl, ch);
  if (!mesure) return null;
  const { transparent, bx: bxEch, by: byEch, bw: bwEch, bh: bhEch } = mesure;

  const bx = bxEch / k;
  const by = byEch / k;
  const bw = Math.min(largeur - bx, bwEch / k);
  const bh = Math.min(hauteur - by, bhEch / k);

  // Le cadrage ne retire presque rien : inutile de compliquer l'affichage.
  const gain = 1 - (bw / largeur) * (bh / hauteur);
  if (gain < GAIN_MIN) return null;

  return { bx, by, bw, bh, largeur, hauteur, transparent };
}
