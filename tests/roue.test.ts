/**
 * Tests du moteur de jeu (Node 22, exécution directe du TypeScript).
 *
 *   node --experimental-strip-types --test tests/roue.test.ts
 *
 * Ce que l'on vérifie :
 *  1. La roue a toujours un nombre PAIR de cases (≥ 8).
 *  2. Pour CHAQUE case, l'angle calculé place bien le CENTRE de cette case
 *     sous l'aiguille (aucune ambiguïté entre deux cases).
 *  3. La distribution du tirage correspond aux probabilités déclarées.
 *  4. Les lots à stock 0 ne sortent jamais.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CASES_MIN,
  angleCible,
  angleParCase,
  construireCases,
  couleurTexteSur,
} from "../src/lib/roue.ts";
import { tirerGagnant } from "../src/lib/tirage-serveur.ts";

const cadeaux = [
  { id: 1, nom: "Bon 5 000", couleur: "#C9A227", icone: "🎟️", probabilite: 2, stock: 10 },
  { id: 2, nom: "Casquette", couleur: "#8B1E3F", icone: "🧢", probabilite: 12, stock: 25 },
  { id: 3, nom: "Sac", couleur: "#1F6F5C", icone: "🛍️", probabilite: 15, stock: 30 },
  { id: 4, nom: "Crème", couleur: "#B4552A", icone: "🧴", probabilite: 10, stock: 20 },
  { id: 5, nom: "Stylo", couleur: "#3A4A7A", icone: "🖊️", probabilite: 26, stock: 80 },
  { id: 6, nom: "Échantillon", couleur: "#6B4A7A", icone: "🌸", probabilite: 20, stock: 60 },
  { id: 7, nom: "Réduction 10 %", couleur: "#0F6B6B", icone: "💸", probabilite: 15, stock: 200 },
  { id: 8, nom: "Café", couleur: "#4A3F35", icone: "☕", probabilite: 20, stock: 40 },
];

test("la roue a un nombre pair de cases et au moins CASES_MIN", () => {
  for (const nombre of [1, 2, 3, 5, 7, 8, 11]) {
    const cases = construireCases(cadeaux.slice(0, nombre));
    assert.ok(cases.length >= CASES_MIN, `${nombre} lots → ${cases.length} cases`);
    assert.equal(cases.length % 2, 0, "le nombre de cases doit être pair");
  }
});

test("les cases « perdues » ont un identifiant unique négatif", () => {
  const cases = construireCases(cadeaux.slice(0, 3));
  const ids = cases.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "identifiants uniques");
  assert.equal(ids.filter((id) => id < 0).length, cases.length - 3);
});

test("l'aiguille s'arrête EXACTEMENT sur la case visée, pour chaque case", () => {
  const cases = construireCases(cadeaux);
  const n = cases.length;
  const secteur = angleParCase(n);

  for (let index = 0; index < n; index += 1) {
    // Pour plusieurs nombres de tours, l'arrêt doit être identique.
    for (const tours of [0, 1, 7, 12]) {
      const angle = angleCible(index, n, tours);

      // Reprise de la formule du composant <Roue> : case sous l'aiguille.
      const normalise = ((-angle % 360) + 360) % 360;
      const caseSousAiguille = Math.floor(normalise / secteur) % n;

      assert.equal(
        caseSousAiguille,
        index,
        `case ${index} (${cases[index].nom}) : aiguille sur ${caseSousAiguille} avec ${tours} tours`,
      );
    }
  }
});

test("les centres de deux cases opposées ne se confondent pas", () => {
  const cases = construireCases(cadeaux);
  const n = cases.length;
  const secteur = angleParCase(n);
  for (let i = 0; i < n; i += 1) {
    const centreI = i * secteur + secteur / 2;
    const centreOppose = (i + n / 2) * secteur + secteur / 2;
    assert.notEqual(
      ((centreI % 360) + 360) % 360,
      ((centreOppose % 360) + 360) % 360,
      "deux cases opposées ne peuvent pas avoir le même centre",
    );
  }
});

test("le tirage respecte les probabilités déclarées (loi des grands nombres)", () => {
  const disponibles = [
    { id: 1, probabilite: 10 }, // 10 %
    { id: 2, probabilite: 40 }, // 40 %
    { id: 3, probabilite: 50 }, // 50 % → total 100 % : aucun perdant
  ];

  const N = 200_000;
  const compte = new Map<number, number>();
  let perdants = 0;

  for (let i = 0; i < N; i += 1) {
    const resultat = tirerGagnant(disponibles);
    if (resultat === null) perdants += 1;
    else compte.set(resultat.id, (compte.get(resultat.id) ?? 0) + 1);
  }

  assert.equal(perdants, 0, "aucun perdant quand le total fait 100 %");

  const attendus: [number, number][] = [
    [1, 10],
    [2, 40],
    [3, 50],
  ];
  for (const [id, pourcentage] of attendus) {
    const observe = ((compte.get(id) ?? 0) / N) * 100;
    assert.ok(
      Math.abs(observe - pourcentage) < 0.6,
      `cadeau ${id} : attendu ${pourcentage} %, observé ${observe.toFixed(2)} %`,
    );
  }
});

test("les cases perdantes existent quand le total des chances < 100 %", () => {
  const N = 100_000;
  let perdants = 0;
  const disponibles = [
    { id: 1, probabilite: 15 },
    { id: 2, probabilite: 15 },
  ];

  for (let i = 0; i < N; i += 1) {
    if (tirerGagnant(disponibles) === null) perdants += 1;
  }

  const pourcentage = (perdants / N) * 100;
  assert.ok(
    Math.abs(pourcentage - 70) < 1,
    `attendu ~70 % de perdants, observé ${pourcentage.toFixed(2)} %`,
  );
});

test("un lot à stock 0 n'est jamais tiré (il est exclu en amont)", () => {
  // Le filtrage stock > 0 se fait dans effectuerTirage ; ici on vérifie que la
  // fonction de tirage respecte les poids fournis et ne renvoie rien d'autre.
  const disponibles = [{ id: 42, probabilite: 100 }];
  for (let i = 0; i < 1000; i += 1) {
    const resultat = tirerGagnant(disponibles);
    assert.ok(resultat === null || resultat.id === 42);
  }
});

test("la couleur du texte reste lisible sur le fond", () => {
  assert.equal(couleurTexteSur("#ffffff"), "#151210", "blanc → texte sombre");
  assert.equal(couleurTexteSur("#000000"), "#FFF8E7", "noir → texte clair");
  assert.equal(couleurTexteSur("#C9A227"), "#151210", "or → texte sombre");
});

test("cas extrême : probabilités supérieures à 100 % restent sûres", () => {
  const disponibles = [
    { id: 1, probabilite: 80 },
    { id: 2, probabilite: 80 },
  ];
  for (let i = 0; i < 20_000; i += 1) {
    const resultat = tirerGagnant(disponibles);
    assert.ok(resultat === null || resultat.id === 1 || resultat.id === 2);
  }
});

test("le nombre de cases suit le réglage de l'exploitant", () => {
  // 8 lots + 4 cases « Perdu » = 12 cases.
  assert.equal(construireCases(cadeaux, 12).length, 12);
  // 16 demandées avec 8 lots → 8 cases « Perdu ».
  assert.equal(construireCases(cadeaux, 16).length, 16);
  // Un réglage impair est ramené au pair le plus proche.
  assert.equal(construireCases(cadeaux, 11).length, 12);
  // Les bornes s'appliquent (jamais moins de 4, jamais plus de 32).
  assert.equal(construireCases(cadeaux, 2).length, 8, "8 lots ⇒ au moins 8 cases");
  assert.equal(construireCases(cadeaux, 999).length, 32);
  // Un catalogue plus fourni que le réglage n'est jamais tronqué : tous les
  // lots restent visibles, donc gagnables.
  assert.equal(construireCases(cadeaux, 4).length, 8);
});
