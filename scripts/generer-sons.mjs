/**
 * Synthétise les sons du jeu en WAV 16 bits mono 22 050 Hz (≈ 60 Ko au total).
 * Aucune banque de sons externe : licences libres garanties.
 *
 *   node scripts/generer-sons.mjs
 *
 * Fichiers générés dans public/sons/ : tic.wav, victoire.wav, perte.wav.
 */
import { writeFileSync, mkdirSync } from "node:fs";

const FREQ = 22_050;

/** Chien de garde : évite les clics en fin de son. */
const enveloppe = (t, duree, attaque = 0.004, relachement = 0.06) => {
  if (t < attaque) return t / attaque;
  if (t > duree - relachement) return Math.max((duree - t) / relachement, 0);
  return 1;
};

function wav(echantillons) {
  const octets = Buffer.alloc(echantillons.length * 2);
  echantillons.forEach((v, i) => {
    const s = Math.max(-1, Math.min(1, v));
    octets.writeInt16LE(Math.round(s * 32767), i * 2);
  });

  const entete = Buffer.alloc(44);
  entete.write("RIFF", 0);
  entete.writeUInt32LE(36 + octets.length, 4);
  entete.write("WAVE", 8);
  entete.write("fmt ", 12);
  entete.writeUInt32LE(16, 16);
  entete.writeUInt16LE(1, 20); // PCM
  entete.writeUInt16LE(1, 22); // mono
  entete.writeUInt32LE(FREQ, 24);
  entete.writeUInt32LE(FREQ * 2, 28);
  entete.writeUInt16LE(2, 32);
  entete.writeUInt16LE(16, 34);
  entete.write("data", 36);
  entete.writeUInt32LE(octets.length, 40);

  return Buffer.concat([entete, octets]);
}

/* --------------------------------------------------------------------------
 * 1. TIC DE LA ROUE — clic bref en bois, légèrement métallique
 * -------------------------------------------------------------------------- */
function tic() {
  const duree = 0.055;
  const n = Math.floor(FREQ * duree);
  const sortie = [];
  for (let i = 0; i < n; i += 1) {
    const t = i / FREQ;
    // Mélange de deux sinus descendants = « clac » de lamelle.
    const f1 = 1850 * Math.exp(-t * 26);
    const f2 = 950 * Math.exp(-t * 20);
    const onde = Math.sin(2 * Math.PI * f1 * t) * 0.55 + Math.sin(2 * Math.PI * f2 * t) * 0.35;
    const bruit = (Math.random() * 2 - 1) * Math.exp(-t * 70) * 0.35;
    sortie.push((onde + bruit) * Math.exp(-t * 34) * enveloppe(t, duree, 0.001, 0.02) * 0.75);
  }
  return wav(sortie);
}

/* --------------------------------------------------------------------------
 * 2. VICTOIRE — arpège majeur montant + scintillement de cloche
 * -------------------------------------------------------------------------- */
function victoire() {
  const duree = 2.4;
  const n = Math.floor(FREQ * duree);
  const sortie = new Array(n).fill(0);

  // Do majeur : C5, E5, G5, C6 (arpège) puis accord tenu.
  const notes = [
    { f: 523.25, debut: 0.0, duree: 0.9, gain: 0.32 },
    { f: 659.25, debut: 0.11, duree: 0.9, gain: 0.3 },
    { f: 783.99, debut: 0.22, duree: 1.0, gain: 0.3 },
    { f: 1046.5, debut: 0.34, duree: 1.6, gain: 0.36 },
    { f: 1318.5, debut: 0.46, duree: 1.4, gain: 0.16 },
    { f: 1567.98, debut: 0.58, duree: 1.2, gain: 0.12 },
  ];

  for (const note of notes) {
    const debut = Math.floor(note.debut * FREQ);
    const longueur = Math.min(Math.floor(note.duree * FREQ), n - debut);
    for (let i = 0; i < longueur; i += 1) {
      const t = i / FREQ;
      // Enveloppe de cloche + harmoniques.
      const env = Math.exp(-t * 2.6) * enveloppe(t, note.duree, 0.003, 0.12);
      const onde =
        Math.sin(2 * Math.PI * note.f * t) * 1.0 +
        Math.sin(2 * Math.PI * note.f * 2 * t) * 0.32 +
        Math.sin(2 * Math.PI * note.f * 3 * t) * 0.12 +
        Math.sin(2 * Math.PI * note.f * 4.2 * t) * 0.06;
      sortie[debut + i] += onde * env * note.gain;
    }
  }

  // Scintillement aléatoire (confettis sonores) sur la fin.
  for (let i = Math.floor(0.7 * FREQ); i < n; i += 1) {
    const t = i / FREQ;
    if (Math.random() < 0.0016) {
      const f = 2400 + Math.random() * 2200;
      for (let j = 0; j < 900 && i + j < n; j += 1) {
        const tt = j / FREQ;
        sortie[i + j] += Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt * 40) * 0.1;
      }
    }
    sortie[i] *= Math.min(1, Math.max(0, (duree - t) / 0.35));
  }

  return wav(sortie.map((v) => Math.tanh(v * 1.1) * 0.85));
}

/* --------------------------------------------------------------------------
 * 3. PERTE — deux notes descendantes douces, sans agressivité
 * -------------------------------------------------------------------------- */
function perte() {
  const duree = 1.5;
  const n = Math.floor(FREQ * duree);
  const sortie = new Array(n).fill(0);

  const notes = [
    { f: 392.0, debut: 0.0, duree: 0.6, gain: 0.3 }, // G4
    { f: 329.63, debut: 0.28, duree: 1.1, gain: 0.32 }, // E4
  ];

  for (const note of notes) {
    const debut = Math.floor(note.debut * FREQ);
    const longueur = Math.min(Math.floor(note.duree * FREQ), n - debut);
    for (let i = 0; i < longueur; i += 1) {
      const t = i / FREQ;
      const env = Math.exp(-t * 2.2) * enveloppe(t, note.duree, 0.02, 0.2);
      // Sinus légèrement filtré (harmonique 2 faible) = son feutré.
      const onde = Math.sin(2 * Math.PI * note.f * t) + Math.sin(2 * Math.PI * note.f * 2 * t) * 0.15;
      sortie[debut + i] += onde * env * note.gain;
    }
  }

  return wav(sortie);
}

mkdirSync("public/sons", { recursive: true });
writeFileSync("public/sons/tic.wav", tic());
writeFileSync("public/sons/victoire.wav", victoire());
writeFileSync("public/sons/perte.wav", perte());
console.log("✅ public/sons/tic.wav, victoire.wav, perte.wav");
