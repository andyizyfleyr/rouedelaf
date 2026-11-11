import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

/**
 * lamejs est distribué en CommonJS : son export ESM n'expose pas MPEGMode,
 * d'où le passage par `require`. (Dépendance de DÉVELOPPEMENT : le fichier
 * MP3 est généré une fois et versionné dans public/sons, l'application ne
 * l'importe jamais.)
 */
const require = createRequire(import.meta.url);
const cheminLame = require.resolve("lamejs/lame.all.js");

/* `lame.all.js` est un script navigateur : il déclare Mp3Encoder dans son
 * scope global sans l'exporter. On l'exécute dans un contexte vm et on relit
 * le symbole — plus fiable que d'espérer un export CommonJS. */
const contexte = vm.createContext({ console, Math, Date, Int16Array, Float32Array, Uint8Array });
vm.runInContext(readFileSync(cheminLame, "utf8"), contexte, { filename: "lame.all.js" });
const Mp3Encoder = contexte.lamejs?.Mp3Encoder;

const FREQ = 22050;

/* --------------------------------------------------------------------------
 *  AMBIANCE « LOUNGE DE CASINO » — boucle de 24 s
 *
 *  Matériau : contrebasse feutrée en pizzicato, accords de piano électrique
 *  (FM douce), rideau de cymbales très léger, nappe grave. Grille de quatre
 *  mesures (Am7 - Dm7 - Fmaj7 - E7#9), 72 BPM : c'est le tempo d'un salon, pas
 *  d'une piste de danse.
 *
 *  Boucle sans couture : tout le matériau est périodique sur 24 s (les notes
 *  se couchent exactement sur la grille, le rideau est enveloppé aux bords), et
 *  la nappe grave est calée sur un nombre entier de cycles. La fin rejoint donc
 *  le début sans « clic ».
 * -------------------------------------------------------------------------- */
const DUREE = 24;
const n = Math.floor(FREQ * DUREE);
const bus = new Float32Array(n);

const ajoute = (i, v) => { if (i >= 0 && i < n) bus[i] += v; };

/** Enveloppe percussive douce (pizzicato). */
const pizz = (t, duree, attaque = 0.008, chute = 2.6) => {
  if (t < attaque) return t / attaque;
  const fin = Math.max((duree - t) / 0.25, 0);
  return Math.min(fin, 1) * Math.exp(-t * chute);
};

/** Piano électrique : FM légère, deux partiels, très doux. */
function notePiano(debut, f, duree, gain) {
  const d0 = Math.floor(debut * FREQ);
  const len = Math.floor(duree * FREQ);
  for (let i = 0; i < len; i += 1) {
    const t = i / FREQ;
    const env = Math.exp(-t * 1.15) * Math.min(1, t / 0.012) * Math.min(1, (duree - t) / 0.35);
    const mod = Math.sin(2 * Math.PI * f * 2 * t) * 0.7 * Math.exp(-t * 3);
    const onde =
      Math.sin(2 * Math.PI * f * t + mod) * 0.6 +
      Math.sin(2 * Math.PI * f * 2 * t) * 0.10 +
      Math.sin(2 * Math.PI * f * 3.01 * t) * 0.04;
    ajoute(d0 + i, onde * env * gain);
  }
}

/** Contrebasse pizzicato : sinus + 2e harmonique, attaque courte. */
function noteBasse(debut, f, duree, gain) {
  const d0 = Math.floor(debut * FREQ);
  const len = Math.floor(duree * FREQ);
  for (let i = 0; i < len; i += 1) {
    const t = i / FREQ;
    const env = pizz(t, duree, 0.006, 2.4);
    const onde = Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 2 * t) * 0.22;
    ajoute(d0 + i, onde * env * gain);
  }
}

/** Rideau : bruit filtré (passe-bas par moyenne glissante) très léger. */
function rideau(debut, duree, gain) {
  const d0 = Math.floor(debut * FREQ);
  const len = Math.floor(duree * FREQ);
  let y = 0;
  for (let i = 0; i < len; i += 1) {
    const t = i / FREQ;
    const bruit = Math.random() * 2 - 1;
    y = y * 0.86 + bruit * 0.14;          // filtre passe-bas UnePasse
    const env = Math.exp(-t * 3.2) * Math.min(1, (duree - t) / 0.2);
    ajoute(d0 + i, y * env * gain * 2.2);
  }
}

/** Nappe grave : deux sinus désaccordés, fondu d'entrée/sortie sur toute la boucle. */
function nappe(f, gain) {
  for (let i = 0; i < n; i += 1) {
    const t = i / FREQ;
    const fondu = Math.min(1, t / 2.2, (DUREE - t) / 2.2);
    ajoute(i, (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * (f * 1.003) * t)) * 0.5 * fondu * gain);
  }
}

/* Grille : 4 mesures de 6 s (24 s), 4 temps par mesure → 1,5 s par temps. */
const TEMPS = 1.5;
const mesures = [
  { basse: 110.0, accord: [261.63, 329.63, 392.0, 493.88] }, // Am7
  { basse: 146.83, accord: [293.66, 349.23, 440.0, 523.25] }, // Dm7
  { basse: 87.31, accord: [220.0, 261.63, 329.63, 392.0] }, // Fmaj7
  { basse: 82.41, accord: [246.94, 311.13, 329.63, 392.0] }, // E7#9
];

let graine = 7;
const alea = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);

mesures.forEach((mesure, m) => {
  const t0 = m * 4 * TEMPS;
  // Contrebasse : temps 1 et 3, une note tenue par temps.
  noteBasse(t0, mesure.basse, TEMPS * 0.95, 0.30);
  noteBasse(t0 + 2 * TEMPS, mesure.basse, TEMPS * 0.95, 0.24);
  // Piano : accord léger sur le temps 2, arpège sur le temps 4.
  mesure.accord.forEach((f, k) => {
    notePiano(t0 + TEMPS + k * 0.045, f, TEMPS * 1.2, 0.052);
    notePiano(t0 + 3 * TEMPS + k * 0.10, f * 2, TEMPS * 0.9, 0.030);
  });
  // Rideau de cymbale : une seule fois par mesure, très bas.
  rideau(t0, 1.6, 0.035);
  // Note de couleur aléatoire (comme un pianiste qui brode).
  notePiano(t0 + 3 * TEMPS + alea() * 0.3, mesure.accord[Math.floor(alea() * 4)] * 4, 1.2, 0.022);
});

// Nappe grave continue (fond harmonique), calée sur un nombre entier de cycles.
nappe(55.0, 0.045);   // La1
nappe(73.42, 0.028);  // Ré2

/* --------------------------------------------------------------------------
 *  Mélange : compression douce (tanh), fondu de boucle de 40 ms aux extrémités
 *  pour garantir l'absence de clic, normalisation autour de -18 dBFS.
 * -------------------------------------------------------------------------- */
const FONDU = Math.floor(0.04 * FREQ);
let crete = 0;
for (let i = 0; i < n; i += 1) {
  let v = Math.tanh(bus[i] * 1.15);
  if (i < FONDU) v *= i / FONDU;
  if (i > n - FONDU) v *= (n - i) / FONDU;
  bus[i] = v;
  crete = Math.max(crete, Math.abs(v));
}
const gainNorm = 0.32 / (crete || 1);

const pcm = new Int16Array(n);
for (let i = 0; i < n; i += 1) {
  pcm[i] = Math.max(-32768, Math.min(32767, Math.round(bus[i] * gainNorm * 32767)));
}

/* MP3 64 kb/s mono : une boucle de 24 s pèse ~190 Ko au lieu de 1 Mo en WAV. */
const encodeur = new Mp3Encoder(1, FREQ, 64);
const morceaux = [];
const BLOC = 1152;
for (let i = 0; i < pcm.length; i += BLOC) {
  const morceau = encodeur.encodeBuffer(pcm.subarray(i, i + BLOC));
  if (morceau.length > 0) morceaux.push(Buffer.from(morceau));
}
const fin = encodeur.flush();
if (fin.length > 0) morceaux.push(Buffer.from(fin));
const mp3 = Buffer.concat(morceaux);
writeFileSync("public/sons/ambiance.mp3", mp3);
console.log("public/sons/ambiance.mp3", Math.round(mp3.length / 1024), "ko —", DUREE, "s de boucle");
