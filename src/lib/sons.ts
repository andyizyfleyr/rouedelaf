"use client";

import { Howl } from "howler";

/**
 * Gestionnaire de sons (Howler.js).
 *
 * Les fichiers sont synthétisés (voir scripts/generer-sons.mjs) : aucun
 * téléchargement, aucune licence tierce, 175 Ko au total.
 *
 * Particularités mobiles gérées ici :
 *  - iOS/Android interdisent l'audio avant une interaction : on « déverrouille »
 *    Howler au premier toucher.
 *  - Le tic est limité en fréquence (max ~18/s) pour ne pas saturer le processeur
 *    d'un petit téléphone quand la roue tourne vite.
 *  - Le choix « couper le son » est mémorisé dans localStorage.
 */

let ambiance: Howl | null = null;
let ambianceLancee = false;
let tic: Howl | null = null;
let victoire: Howl | null = null;
let perte: Howl | null = null;
let muet = false;
let dernierTic = 0;
let initialise = false;

const CLE_MUET = "roue:muet";
/** Coupure de la musique d'ambiance seule (le son du jeu reste actif). */
const CLE_AMBIANCE = "roue:ambiance-coupee";

/** Volume de la musique de fond : discrète, elle accompagne la roue. */
const VOLUME_AMBIANCE = 0.22;

function creerSons() {
  if (initialise || typeof window === "undefined") return;
  initialise = true;

  muet = window.localStorage.getItem(CLE_MUET) === "1";

  tic = new Howl({
    src: ["/sons/tic.wav"],
    volume: 0.35,
    preload: true,
    pool: 6, // 6 instances : largement suffisant avec la limite de fréquence
  });

  victoire = new Howl({
    src: ["/sons/victoire.wav"],
    volume: 0.75,
    preload: true,
  });

  perte = new Howl({
    src: ["/sons/perte.wav"],
    volume: 0.55,
    preload: true,
  });

  /*
   * Musique de fond : boucle de 24 s synthétisée (scripts/generer-ambiance.mjs),
   * 188 Ko en MP3. `loop: true` enchaîne sans repasser par le réseau, et
   * l'image de départ est calée sur une grille de tempo : la boucle ne
   * s'entend pas.
   *
   * `alpha`/`fade` : on ne la démarre jamais à plein volume — une musique qui
   * surgit fait sursauter derrière un comptoir.
   */
  ambiance = new Howl({
    src: ["/sons/ambiance.mp3"],
    loop: true,
    volume: 0,
    preload: true,
    html5: false,
  });
}

/**
 * Abonnement au réglage « musique coupée ».
 *
 * Sert à `useSyncExternalStore` côté composant : l'état vit dans
 * localStorage, pas dans React. Sans ça, lire localStorage au montage
 * provoquait un rendu différent du HTML prérendu (erreur d'hydratation), et
 * un `setState` dans un effet déclenchait des rendus en cascade.
 */
const abonnesAmbiance = new Set<() => void>();

export function abonnerAmbiance(abonne: () => void): () => void {
  abonnesAmbiance.add(abonne);
  return () => {
    abonnesAmbiance.delete(abonne);
  };
}

function notifierAmbiance(): void {
  for (const abonne of abonnesAmbiance) abonne();
}

/** L'ambiance a-t-elle été coupée par l'exploitant ? */
export function estAmbianceCoupee(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CLE_AMBIANCE) === "1";
}

/**
 * Démarre (ou reprend) la musique de fond.
 *
 * ⚠️ Aucun navigateur mobile n'autorise l'audio sans interaction : le premier
 * appel échoue silencieusement. L'écran de la roue rappelle donc cette
 * fonction à la première touche de l'utilisateur (voir AmbianceCasino), et le
 * moyeu la rappelle aussi au moment du tirage.
 */
export function demarrerAmbiance(): void {
  creerSons();
  if (!ambiance || muet || estAmbianceCoupee()) return;
  if (ambianceLancee) return;

  ambianceLancee = true;
  ambiance.volume(0);
  ambiance.play();
  ambiance.fade(0, VOLUME_AMBIANCE, 1800);
}

/** Coupe la musique de fond (sans toucher aux sons du jeu). */
export function couperAmbiance(): void {
  creerSons();
  if (!ambiance) return;
  ambiance.fade(ambiance.volume() as number, 0, 500);
  window.setTimeout(() => {
    ambiance?.pause();
    ambianceLancee = false;
  }, 520);
}

/** Bascule l'ambiance ; renvoie true si elle est désormais coupée. */
export function basculerAmbiance(): boolean {
  creerSons();
  const coupee = !estAmbianceCoupee();
  window.localStorage.setItem(CLE_AMBIANCE, coupee ? "1" : "0");
  if (coupee) couperAmbiance();
  else demarrerAmbiance();
  notifierAmbiance();
  return coupee;
}

/** À appeler sur la première interaction utilisateur (politique navigateurs). */
export function deverrouillerAudio(): void {
  creerSons();
  const ctx = (Howl as unknown as { ctx?: AudioContext }).ctx;
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

export function jouerTic(vitesse = 1): void {
  creerSons();
  if (muet || !tic) return;

  const maintenant = performance.now();
  if (maintenant - dernierTic < 55) return; // anti-saturation
  dernierTic = maintenant;

  // Hauteur légèrement variable : évite l'effet « boucle » robotique.
  const id = tic.play();
  tic.rate(0.94 + Math.random() * 0.12, id);
  tic.volume(Math.min(0.18 + vitesse * 0.22, 0.45), id);
}

export function jouerVictoire(): void {
  creerSons();
  if (muet) return;
  victoire?.play();
}

export function jouerPerte(): void {
  creerSons();
  if (muet) return;
  perte?.play();
}

export function basculerMuet(): boolean {
  creerSons();
  muet = !muet;
  window.localStorage.setItem(CLE_MUET, muet ? "1" : "0");
  if (muet) {
    tic?.stop();
    victoire?.stop();
    perte?.stop();
    couperAmbiance();
  } else {
    // Réactiver le son doit aussi relancer la musique de fond.
    demarrerAmbiance();
  }
  return muet;
}

export function estMuet(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CLE_MUET) === "1";
}
