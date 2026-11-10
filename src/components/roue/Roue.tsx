"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { angleCible, angleParCase, cheminSecteur, couleurTexteSur } from "@/lib/roue";
import { jouerTic } from "@/lib/sons";
import type { CadeauRoue } from "@/lib/types";

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  LA ROUE — SVG + Framer Motion
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Animation réaliste :
 *  1. Démarrage rapide (accélération sur les 550 premiers ms).
 *  2. Ralentissement progressif en courbe exponentielle.
 *  3. Petit rebond de l'aiguille à chaque case franchie (son « tic »).
 *  4. Arrêt PILE sur la case annoncée par le serveur.
 *
 * Choix de performance (petits Android) :
 *  - Un SEUL élément animé (le groupe <g> de la roue) en transform.
 *  - `will-change: transform` + composition GPU.
 *  - Les cases sont en SVG statique, gravées une seule fois (useMemo).
 *  - Les sons sont limités en fréquence (voir lib/sons.ts).
 */
export type RoueProps = {
  cases: CadeauRoue[];
  /** Index de la case où l'aiguille doit s'arrêter (calculé par le serveur). */
  caseCible: number | null;
  /** Nombre de tours complets avant l'arrêt. */
  tours?: number;
  /** Durée totale de l'animation en secondes. */
  duree?: number;
  /** Appelé quand la roue est immobile. */
  onFin?: () => void;
  /** Rotation actuelle (utile pour synchroniser un état). */
  taille?: number;
  /** Classe CSS additionnelle. */
  className?: string;
};

const TAILLE = 340; // viewBox : unités logiques, redimensionnées en CSS
const CENTRE = TAILLE / 2;
const RAYON = TAILLE / 2 - 6;

export function Roue({
  cases,
  caseCible,
  tours = 7,
  duree = 6.2,
  onFin,
  taille,
  className,
}: RoueProps) {
  const rotation = useMotionValue(0);
  const [enMouvement, setEnMouvement] = useState(false);
  const [indexSousAiguille, setIndexSousAiguille] = useState<number | null>(null);
  /** Incrémenté à chaque case franchie : déclenche le rebond de l'aiguille. */
  const [rebond, setRebond] = useState(0);
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);
  const rotationRef = useRef(0);

  // Mémoïse la géométrie : recalculée uniquement si les cases changent.
  const secteurs = useMemo(() => {
    const secteur = angleParCase(cases.length);
    return cases.map((c, i) => ({
      ...c,
      debut: i * secteur,
      fin: (i + 1) * secteur,
      chemin: cheminSecteur(CENTRE, CENTRE, RAYON, i * secteur, (i + 1) * secteur),
      couleurTexte: couleurTexteSur(c.couleur),
      angleTexte: i * secteur + secteur / 2,
      // Les libellés courts restent lisibles même sur 16 cases.
      libelle: c.id < 0 ? "PERDU" : c.nom,
    }));
  }, [cases]);

  useEffect(() => {
    const unsubscribe = rotation.on("change", (valeur) => {
      rotationRef.current = valeur;
      // Indique la case actuellement sous l'aiguille (en haut = -90°).
      const secteur = 360 / Math.max(cases.length, 1);
      const normalise = ((-valeur % 360) + 360) % 360;
      const index = Math.floor(normalise / secteur) % cases.length;
      setIndexSousAiguille(index);
    });
    return unsubscribe;
  }, [rotation, cases.length]);

  useEffect(() => () => animationRef.current?.stop(), []);

  /** Lance la rotation jusqu'à la case cible. */
  const lancer = useCallback(() => {
    if (caseCible === null || cases.length === 0) return;

    animationRef.current?.stop();
    setEnMouvement(true);

    let intervalleRebond = 999;
    const depart = rotationRef.current;
    // On repart toujours de l'angle modulo 360 pour des durées constantes.
    const base = depart - (depart % 360);
    const arrivee = base + angleCible(caseCible, cases.length, tours);

    let dernierTicIndex = -1;
    let dernierTempsTic = 0;

    animationRef.current = animate(rotation, arrivee, {
      duration: duree,
      // Courbe « roue de casino » : montée rapide puis très long freinage.
      ease: [0.12, 0.62, 0.08, 1],
      onUpdate: (valeur) => {
        // Tic à chaque changement de case (et non à chaque frame).
        const secteur = 360 / cases.length;
        const index = Math.floor(Math.abs(valeur) / secteur);
        if (index !== dernierTicIndex) {
          dernierTicIndex = index;
          // Rebond uniquement pendant la phase rapide : au ralenti,
          // le ressort n'aurait pas le temps de se replacer.
          if (intervalleRebond < 240) setRebond((r) => r + 1);
          const maintenant = performance.now();
          const intervalle = maintenant - dernierTempsTic;
          intervalleRebond = intervalle;
          dernierTempsTic = maintenant;
          // Plus la roue tourne vite, plus le son est présent (mais borné).
          const vitesse = Math.min(1, Math.max(0.25, 220 / Math.max(intervalle, 1)));
          jouerTic(vitesse);
        }
      },
      onComplete: () => {
        setEnMouvement(false);
        onFin?.();
      },
    });
  }, [caseCible, cases.length, duree, onFin, rotation, tours]);

  // Déclenchement automatique dès que le serveur a répondu.
  // (le lancement est différé : `lancer` met à jour l'état de la roue, on ne
  // veut pas le faire de façon synchrone dans le corps de l'effet.)
  useEffect(() => {
    if (caseCible === null) return;
    const id = setTimeout(lancer, 0);
    return () => clearTimeout(id);
  }, [caseCible, lancer]);

  // La roue tourne sur elle-même : on n'applique que `rotate` (composé GPU).
  const rotationCss = useTransform(rotation, (v) => `rotate(${v}deg)`);

  return (
    <div
      className={`relative mx-auto aspect-square w-full ${className ?? ""}`}
      style={{ maxWidth: taille ?? 420 }}
    >
      {/* Halo lumineux derrière la roue */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(232,198,106,0.32),transparent_68%)] blur-2xl" />
      </div>

      <svg
        viewBox={`0 0 ${TAILLE} ${TAILLE}`}
        className="roue-masque h-full w-full"
        aria-label="Roue de la fortune"
        role="img"
      >
        <defs>
          <radialGradient id="gradCentre" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff3c4" />
            <stop offset="45%" stopColor="#e8c66a" />
            <stop offset="100%" stopColor="#8d6b1d" />
          </radialGradient>
          <linearGradient id="gradJante" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff3c4" />
            <stop offset="22%" stopColor="#c9a227" />
            <stop offset="50%" stopColor="#7a5a14" />
            <stop offset="72%" stopColor="#e8c66a" />
            <stop offset="100%" stopColor="#5d4410" />
          </linearGradient>
          <linearGradient id="gradAiguille" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff3c4" />
            <stop offset="55%" stopColor="#e8c66a" />
            <stop offset="100%" stopColor="#8d6b1d" />
          </linearGradient>
          <filter id="ombreAiguille" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.65" />
          </filter>
          {/* Reflet animé sur la jante */}
          <linearGradient id="reflet" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="45%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {/* Jante extérieure dorée */}
        <circle cx={CENTRE} cy={CENTRE} r={RAYON} fill="url(#gradJante)" />
        <circle cx={CENTRE} cy={CENTRE} r={RAYON - 5} fill="#0d0b0a" />

        {/* Roue tournante */}
        <motion.g
          style={{
            rotate: rotationCss,
            transformOrigin: "center",
            transformBox: "view-box",
            willChange: "transform",
          }}
        >
          <circle cx={CENTRE} cy={CENTRE} r={RAYON - 6} fill="#0b0a09" />
          {secteurs.map((s) => (
            <path
              key={`secteur-${s.id}-${s.debut}`}
              d={s.chemin}
              fill={s.couleur}
              stroke="rgba(0,0,0,0.32)"
              strokeWidth={0.8}
            />
          ))}
          {/* Petites ampoules décoratives sur la jante */}
          {secteurs.map((s) => {
            const rad = ((s.debut - 90) * Math.PI) / 180;
            const r = RAYON - 7;
            return (
              <circle
                key={`ampoule-${s.id}-${s.debut}`}
                cx={CENTRE + r * Math.cos(rad)}
                cy={CENTRE + r * Math.sin(rad)}
                r={2.4}
                fill="#fff3c4"
                opacity={0.85}
              />
            );
          })}
          {/* Libellés, un par case */}
          {secteurs.map((s) => (
            <CasedeRoue key={`case-${s.id}-${s.debut}`} secteur={s} />
          ))}
          {/* Reflet diagonal fixe sur la roue */}
          <circle
            cx={CENTRE}
            cy={CENTRE}
            r={RAYON - 8}
            fill="url(#reflet)"
            opacity={enMouvement ? 0.1 : 0.06}
          />
        </motion.g>

        {/* Aiguille : un petit rebond (ressort) à chaque case franchie */}
        <motion.g
          key={rebond}
          filter="url(#ombreAiguille)"
          style={{ transformOrigin: "center top", transformBox: "view-box" }}
          initial={{ rotate: enMouvement ? -9 : 0 }}
          animate={{ rotate: 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 11, mass: 0.45 }}
        >
          <path
            d={`M ${CENTRE} 10
                L ${CENTRE + 13} 44
                L ${CENTRE} 60
                L ${CENTRE - 13} 44 Z`}
            fill="url(#gradAiguille)"
            stroke="#5d4410"
            strokeWidth={1.2}
          />
        </motion.g>

        {/* Moyeu central */}
        <circle cx={CENTRE} cy={CENTRE} r={26} fill="url(#gradJante)" />
        <circle cx={CENTRE} cy={CENTRE} r={20} fill="url(#gradCentre)" />
        <circle cx={CENTRE} cy={CENTRE} r={9} fill="#0b0a09" />
        <circle cx={CENTRE} cy={CENTRE} r={9} fill="none" stroke="rgba(255,243,196,0.6)" strokeWidth={1} />

        {/* Point lumineux tournant sur la jante quand ça tourne */}
        {enMouvement && (
          <motion.circle
            cx={CENTRE}
            cy={CENTRE}
            r={RAYON - 3}
            fill="none"
            stroke="rgba(255,243,196,0.9)"
            strokeWidth={2}
            strokeDasharray="14 300"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: `${CENTRE}px ${CENTRE}px` }}
          />
        )}
      </svg>

      {/* Nom de la case sous l'aiguille : feedback immédiat */}
      <div className="pointer-events-none absolute inset-x-0 -bottom-2 flex justify-center">
        <span className="rounded-full border border-or/25 bg-nuit/85 px-3 py-1 text-[11px] font-semibold tracking-wider text-cendre uppercase backdrop-blur">
          {enMouvement
            ? "La roue tourne…"
            : indexSousAiguille !== null && cases[indexSousAiguille]?.id >= 0
              ? cases[indexSousAiguille].nom
              : "Bonne chance !"}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Une case : secteur + texte incurvé                                        */
/* -------------------------------------------------------------------------- */
type Secteur = {
  id: number;
  nom: string;
  icone: string;
  couleur: string;
  couleurTexte: string;
  debut: number;
  fin: number;
  chemin: string;
  angleTexte: number;
  libelle: string;
};

/**
 * Libellé d'une case, placé TANGENTIELLEMENT (le long du rayon) et toujours
 * lisible : les cases de la moitié gauche sont retournées de 180° pour que le
 * texte ne soit jamais la tête en bas (défaut classique des roues SVG).
 */
function CasedeRoue({ secteur }: { secteur: Secteur }) {
  const lignes = decouper(secteur.libelle, secteur.libelle.length > 12 ? 12 : 16);
  const aRetourner = secteur.angleTexte > 180;
  // Position radiale : le libellé occupe la couronne extérieure (là où il y a
  // le plus de place), l'icône est rapprochée du moyeu pour ne jamais se
  // chevaucher, même avec deux lignes de texte.
  const distanceTexte = RAYON - 34;
  const distanceIcone = RAYON * 0.42;

  return (
    <g transform={`rotate(${secteur.angleTexte} ${CENTRE} ${CENTRE})`}>
      {/* Icône (emoji) : orientée vers le centre, jamais retournée */}
      <text
        x={CENTRE}
        y={CENTRE - distanceIcone}
        textAnchor="middle"
        fontSize={16}
        style={{ pointerEvents: "none" }}
      >
        {secteur.icone}
      </text>

      {/* Libellé : ancré sur le rayon, incliné de -90° (lecture tangentielle) */}
      <g
        transform={
          aRetourner
            ? `translate(${CENTRE} ${CENTRE - distanceTexte}) rotate(90) `
            : `translate(${CENTRE} ${CENTRE - distanceTexte}) rotate(-90) `
        }
      >
        <text
          x={0}
          y={0}
          textAnchor={aRetourner ? "start" : "end"}
          dominantBaseline="middle"
          fill={secteur.couleurTexte}
          fontSize={lignes.length > 1 ? 9 : 10.5}
          fontWeight={700}
          letterSpacing={0.2}
          style={{
            fontFamily: "Manrope Variable, system-ui, sans-serif",
            pointerEvents: "none",
            textShadow: "0 1px 2px rgba(0,0,0,0.35)",
          }}
        >
          {lignes.map((ligne, i) => (
            <tspan
              key={i}
              x={0}
              dy={i === 0 ? (lignes.length > 1 ? -6 : 0) : 11}
            >
              {ligne}
            </tspan>
          ))}
        </text>
      </g>
    </g>
  );
}

/** Coupe un libellé en deux lignes lisibles. */
export function decouper(texte: string, max: number): string[] {
  if (texte.length <= max) return [texte];
  const mots = texte.split(" ");
  const lignes: string[] = [];
  let courante = "";
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (essai.length > max && courante) {
      lignes.push(courante);
      courante = mot;
    } else {
      courante = essai;
    }
  }
  if (courante) lignes.push(courante);
  return lignes.slice(0, 2);
}
