/**
 * Tests de la mesure de cadrage des photos de produit (`analyserPixels`).
 *
 *   node --experimental-strip-types --test tests/recadrage.test.ts
 *
 * Pourquoi ces tests existent : la roue affichait un produit « coincé », puis
 * — après correction de la géométrie — les photos n'étaient toujours pas
 * recadrées. La cause était une condition INVERSÉE dans la détection du fond
 * sur les images transparentes : l'alpha (le vide autour du produit) était
 * pris pour du produit, et le produit pour du vide. Résultat, aucune boîte
 * englobante n'était trouvée et la photo s'affichait entière, en petit.
 *
 * Les quatre cas ci-dessous couvrent exactement les photos réelles fournies
 * par l'exploitant :
 *  1. produit vertical sur fond blanc (pH-mètre, remplisseuse) ;
 *  2. produit large sur fond blanc (pistolet à air chaud) ;
 *  3. PNG transparent (produit détouré) ;
 *  4. photo d'ambiance (fond non uni) — ne doit JAMAIS être rognée.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { analyserPixels } from "../src/lib/recadrage.ts";

/** Construit une vignette RGBA de `cote`×`cote` remplie par `couleur(x, y)`. */
function vignette(
  cote: number,
  couleur: (x: number, y: number) => [number, number, number, number],
): Uint8Array {
  const pixels = new Uint8Array(cote * cote * 4);
  for (let y = 0; y < cote; y += 1) {
    for (let x = 0; x < cote; x += 1) {
      const [r, v, b, a] = couleur(x, y);
      const i = (y * cote + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = v;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    }
  }
  return pixels;
}

const dansBoite = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) =>
  x >= x0 && x <= x1 && y >= y0 && y <= y1;

test("fond blanc : la boîte englobante épouse le produit, pas l'image", () => {
  const C = 200;
  const pixels = vignette(C, (x, y) =>
    dansBoite(x, y, 80, 20, 120, 180) ? [30, 60, 90, 255] : [255, 255, 255, 255],
  );

  const mesure = analyserPixels(pixels, C, C);
  assert.ok(mesure, "un produit sur fond blanc doit être mesuré");
  assert.equal(mesure.transparent, false);

  // Le produit occupe x∈[80,120] et y∈[20,180] : le cadre doit être proche,
  // avec une petite marge de respiration (2,5 %), jamais l'image entière.
  assert.ok(mesure.bx <= 80 && mesure.bx >= 74, `bx = ${mesure.bx}`);
  assert.ok(mesure.by <= 20 && mesure.by >= 14, `by = ${mesure.by}`);
  assert.ok(mesure.bx + mesure.bw >= 121 && mesure.bx + mesure.bw <= 127);
  assert.ok(mesure.by + mesure.bh >= 181 && mesure.by + mesure.bh <= 187);

  // Le point clé : on a bien RETIRÉ les marges blanches.
  assert.ok(mesure.bw < C * 0.35, `largeur cadrée trop grande : ${mesure.bw}`);
  assert.ok(mesure.bh < C * 0.95, `hauteur cadrée trop grande : ${mesure.bh}`);
});

test("PNG transparent : le fond est l'ALPHA, pas le produit (régression)", () => {
  const C = 200;
  const pixels = vignette(C, (x, y) =>
    dansBoite(x, y, 70, 30, 130, 170) ? [240, 240, 245, 255] : [0, 0, 0, 0],
  );

  const mesure = analyserPixels(pixels, C, C);
  assert.ok(mesure, "un PNG détouré doit être mesuré");
  assert.equal(mesure.transparent, true);

  // Avant le correctif, la boîte englobante valait l'image ENTIÈRE (le fond
  // transparent était compté comme du produit) : largeur ≈ 200.
  assert.ok(
    mesure.bw < C * 0.4,
    `la boîte englobante doit suivre le produit, pas le canvas : ${mesure.bw}`,
  );
  assert.ok(mesure.bx > 60 && mesure.bx < 72, `bx = ${mesure.bx}`);
  assert.ok(mesure.by > 20 && mesure.by < 32, `by = ${mesure.by}`);
});

test("photo d'ambiance (fond non uni) : aucune mesure, donc aucun rognage", () => {
  const C = 200;
  // Dégradé marqué : c'est un mur, un atelier, un ciel — pas un fond studio.
  const pixels = vignette(C, (x, y) => [
    40 + Math.round((x / C) * 180),
    60 + Math.round((y / C) * 150),
    30,
    255,
  ]);

  assert.equal(analyserPixels(pixels, C, C), null);
});

test("image entièrement uniforme : rien à cadrer", () => {
  const C = 60;
  const pixels = vignette(C, () => [255, 255, 255, 255]);
  assert.equal(analyserPixels(pixels, C, C), null);
});
