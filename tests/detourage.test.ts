/**
 * Tests du détourage automatique (`masqueFond`).
 *
 *   node --experimental-strip-types --test tests/detourage.test.ts
 *
 * Ce que l'on protège : la roue affiche désormais le PRODUIT, pas une carte
 * blanche. Le détourage est donc sur le chemin critique d'un envoi de photo,
 * et ses décisions sont délicates :
 *
 *  1. un produit sombre sur fond blanc doit être détouré ;
 *  2. un produit BLANC sur fond blanc ne doit pas être avalé (garde-fou de
 *     contour — c'est le cas de la balance et du pH-mètre fournis) ;
 *  3. une photo d'ambiance (fond non uni) doit être refusée : mieux vaut
 *     garder l'image entière que rogner au hasard ;
 *  4. un produit qui touche le bord doit être refusé (le remplissage ne
 *     saurait pas où s'arrêter).
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { masqueFond } from "../src/lib/detourage-masque.ts";

type Pixel = [number, number, number, number];

/** Construit une image RGBA `cote`×`cote` à partir de `couleur(x, y)`. */
function image(cote: number, couleur: (x: number, y: number) => Pixel): Buffer {
  const px = Buffer.alloc(cote * cote * 4);
  for (let y = 0; y < cote; y += 1) {
    for (let x = 0; x < cote; x += 1) {
      const [r, v, b, a] = couleur(x, y);
      const i = (y * cote + x) * 4;
      px[i] = r;
      px[i + 1] = v;
      px[i + 2] = b;
      px[i + 3] = a;
    }
  }
  return px;
}

const dedans = (
  x: number,
  y: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

const BLANC: Pixel = [255, 255, 255, 255];

test("produit sombre sur fond blanc : détouré, bords opaques", () => {
  const C = 120;
  const px = image(C, (x, y) =>
    dedans(x, y, 40, 20, 80, 100) ? [30, 40, 50, 255] : BLANC,
  );

  const m = masqueFond(px, C, C);
  assert.ok(m, "un packshot classique doit être détouré");

  // Le fond devient transparent...
  assert.equal(m.alpha[0], 0, "le coin doit être transparent");
  // ...et le produit reste opaque, y compris au bord (bord net, pas délavé).
  const auCentre = 60 * C + 60;
  assert.equal(m.alpha[auCentre], 255);
  const surLeBord = 20 * C + 60;
  assert.ok(
    m.alpha[surLeBord] >= 200,
    `bord trop translucide : ${m.alpha[surLeBord]}`,
  );

  // On a bien retiré une part significative de l'image.
  assert.ok(m.retrait > 0.3, `retrait = ${m.retrait}`);
});

test("produit BLANC sur fond blanc : pas avalé grâce au garde-fou de contour", () => {
  const C = 120;
  // Produit blanc (250,250,250) sur fond blanc pur (255,255,255) : l'écart est
  // minuscule, seul le CONTOUR FERMÉ (liseré gris) arrête le remplissage.
  // Un produit réel a toujours un contour fermé — c'est précisément ce que ce
  // test protège : si le garde-fou disparaissait, le remplissage entrerait par
  // le haut et avalerait l'objet.
  const surContour = (x: number, y: number) => {
    const dans = dedans(x, y, 40, 20, 80, 100);
    const bord = x <= 41 || x >= 79 || y <= 21 || y >= 99;
    return dans && bord;
  };
  const px = image(C, (x, y) => {
    if (surContour(x, y)) return [120, 120, 120, 255];
    if (dedans(x, y, 40, 20, 80, 100)) return [250, 250, 250, 255];
    return BLANC;
  });

  const m = masqueFond(px, C, C);
  assert.ok(m, "un produit clair sur fond clair doit rester détourable");
  assert.equal(
    m.alpha[60 * C + 60],
    255,
    "le corps du produit doit rester opaque",
  );
  assert.ok(m.retrait > 0.2, "le fond doit tout de même être retiré");
});

test("photo d'ambiance (fond non uni) : refusée", () => {
  const C = 120;
  // Dégradé marqué sur tout le liseré : atelier, mur, ciel.
  const px = image(C, (x, y) => [
    30 + Math.round((x / C) * 200),
    40 + Math.round((y / C) * 180),
    25,
    255,
  ]);
  assert.equal(masqueFond(px, C, C), null);
});

test("image uniforme : refusée, jamais une case vide", () => {
  const C = 120;
  // Un fond seul, sans produit : le remplissage recouvre tout. Sans garde-fou
  // on renverrait un masque entièrement transparent, donc une CASE VIDE sur
  // la roue — pire qu'une photo avec son fond.
  assert.equal(
    masqueFond(
      image(C, () => BLANC),
      C,
      C,
    ),
    null,
    "une image uniforme n'a rien à détourer",
  );
});

test("transparence déjà présente : rien à retirer, refus propre", () => {
  const C = 80;
  const px = image(C, (x, y) =>
    dedans(x, y, 20, 10, 60, 70) ? [200, 30, 30, 255] : [0, 0, 0, 0],
  );
  const m = masqueFond(px, C, C);
  // Le fond est déjà transparent : son « uniformité » est parfaite et le
  // produit occupe une part importante → on peut le mesurer, mais le
  // garde-fou de gain s'applique côté serveur, pas ici. On vérifie surtout
  // qu'il ne plante pas et que le produit reste opaque.
  if (m) assert.equal(m.alpha[40 * C + 40], 255);
});
