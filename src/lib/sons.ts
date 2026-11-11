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

/**
 * Musique de fond : élément <audio> natif, et non Howler.
 *
 * Pourquoi pas Howler ici ? Le tic et les jingles sont courts et doivent
 * pouvoir se superposer (d'où Howler et son pool). Une boucle de fond, elle,
 * n'a besoin que de `loop` et `volume` — deux attributs que le navigateur gère
 * seul. Surtout, un élément natif se recharge, se met en pause et se débloque
 * (iOS) de façon fiable ; c'est aussi le seul moyen simple de diagnostiquer un
 * échec de lecture (événement `error` sur l'élément).
 */
let ambiance: HTMLAudioElement | null = null;
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
}

/**
 * À appeler sur la première interaction utilisateur (politique navigateurs).
 *
 * Howler garde un contexte WebAudio suspendu tant que personne n'a touché la
 * page : sans ce `resume()`, le tic et le jingle de victoire resteraient muets
 * même après un clic.
 */
export function deverrouillerAudio(): void {
  creerSons();
  const ctx = (Howl as unknown as { ctx?: AudioContext }).ctx;
  if (ctx && ctx.state === "suspended") void ctx.resume();
  // Et on profite de l'interaction pour lancer la musique de fond.
  demarrerAmbiance();
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
 * Prépare l'élément audio de fond (une seule fois).
 *
 * `preload = auto` : la boucle se télécharge pendant que le client regarde la
 * roue, pour démarrer sans délai au premier geste.
 */
function obtenirAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!ambiance) {
    const audio = new Audio("/sons/ambiance.mp3");
    audio.loop = true;
    // L'élément est rattaché au document (masqué) : iOS refuse parfois de
    // jouer un média détaché, et il devient inspectable dans les outils de
    // développement — indispensable quand « la musique ne joue pas ».
    audio.id = "ambiance-casino";
    audio.setAttribute("aria-hidden", "true");
    audio.style.display = "none";
    (document.body ?? document.documentElement).append(audio);
    audio.preload = "auto";
    audio.volume = 0;
    audio.crossOrigin = "anonymous";
    // Un échec de lecture doit être visible dans la console : sans cela, un
    // « la musique ne joue pas » reste indiagnosticable sur le poste.
    audio.addEventListener("error", () => {
      console.warn("[sons] ambiance indisponible", audio.error?.code, audio.error?.message);
    });
    ambiance = audio;
  }
  return ambiance;
}

/** Démarre (ou reprend) la musique de fond, à volume 0 puis fondu. */
export function demarrerAmbiance(): void {
  const audio = obtenirAudio();
  if (!audio || muet || estAmbianceCoupee()) return;
  if (ambianceLancee && !audio.paused) return;

  ambianceLancee = true;
  audio.volume = 0;

  const fondu = () => {
    // Fondu de 1,8 s : une musique qui surgit fait sursauter derrière un
    // comptoir. `requestAnimationFrame` suffit pour un simple volume.
    const debut = performance.now();
    const monter = () => {
      const t = Math.min(1, (performance.now() - debut) / 1800);
      audio.volume = VOLUME_AMBIANCE * t;
      if (t < 1 && ambianceLancee) requestAnimationFrame(monter);
    };
    monter();
  };

  const promesse = audio.play();
  if (promesse && typeof promesse.then === "function") {
    promesse.then(fondu).catch((e) => {
      // Lecture refusée (politique navigateur) : on réessaiera au prochain
      // geste — c'est exactement ce que fait AmbianceCasino.
      ambianceLancee = false;
      console.warn("[sons] ambiance en attente d'une interaction", e?.name);
    });
  } else {
    fondu();
  }
}

function arreterAmbiance(): void {
  ambianceLancee = false;
  if (!ambiance) return;
  ambiance.pause();
}

/** Coupe la musique de fond (sans toucher aux sons du jeu). */
export function couperAmbiance(): void {
  if (!ambiance || ambiance.paused) {
    arreterAmbiance();
    return;
  }
  const audio = ambiance;
  const depart = audio.volume;
  const debut = performance.now();
  const baisser = () => {
    const t = Math.min(1, (performance.now() - debut) / 400);
    audio.volume = Math.max(0, depart * (1 - t));
    if (t < 1) requestAnimationFrame(baisser);
    else arreterAmbiance();
  };
  baisser();
}

/** Bascule l'ambiance ; renvoie true si elle est désormais coupée. */
export function basculerAmbiance(): boolean {
  const coupee = !estAmbianceCoupee();
  window.localStorage.setItem(CLE_AMBIANCE, coupee ? "1" : "0");
  if (coupee) couperAmbiance();
  else demarrerAmbiance();
  notifierAmbiance();
  return coupee;
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
