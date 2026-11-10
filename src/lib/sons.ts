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

let tic: Howl | null = null;
let victoire: Howl | null = null;
let perte: Howl | null = null;
let muet = false;
let dernierTic = 0;
let initialise = false;

const CLE_MUET = "roue:muet";

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
  }
  return muet;
}

export function estMuet(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CLE_MUET) === "1";
}
