"use client";

import { animate, motion, useMotionValue } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { IconeCadeau } from "@/components/roue/IconeCadeau";
import { angleCible, nuancer } from "@/lib/roue";
import { jouerTic } from "@/lib/sons";
import type { CadeauRoue } from "@/lib/types";

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  LA ROUE — SVG verni, animation mécanique réelle
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Ce qui rend une roue « vraie » à l'écran, et qui est implémenté ici :
 *
 *  1. DÉMARRAGE MÉCANIQUE — une petite poussée en arrière puis l'élan, comme
 *     une roue de foire que l'on lance à la main.
 *  2. FREINAGE EXPONENTIEL — `easeOutQuint` : très rapide au début, très lent
 *     à la fin. C'est ce qui donne la sensation de masse.
 *  3. BILLES QUI CLAQUENT — l'aiguille est un ressort : à chaque cloison
 *     franchie, elle est repoussée puis revient. Le rythme ralentit avec la
 *     roue (calculé sur la vitesse réelle, pas un minuteur fixe).
 *  4. ARRÊT DÉCALÉ — l'angle final est légèrement décalé à l'intérieur du
 *     secteur : la roue ne s'arrête jamais deux fois au même endroit.
 *  5. MATIÈRE — chaque secteur est rayé (deux nuances de sa couleur), cerclé
 *     d'un jonc doré, avec reflet, ampoules et moyeu métallique. Les libellés
 *     sont incurvés le long du bord, comme sur une vraie roue.
 *
 * Performance (petits Android en 3G) :
 *  - UN SEUL élément animé (le groupe `<g>`) en `transform` composité GPU ;
 *  - tout le reste est du SVG statique mémorisé ;
 *  - les sons sont bornés (voir lib/sons.ts).
 *
 * ⚠️ `style={{ rotate: valeur }}` de Framer Motion attend un NOMBRE de
 * degrés. Lui passer une chaîne `rotate(120deg)` produit un `transform`
 * invalide et la roue ne bouge pas.
 */

const TAILLE = 400; // viewBox logique, redimensionné en CSS
const CENTRE = TAILLE / 2;
const RAYON = TAILLE / 2 - 4;

export type RoueProps = {
  cases: CadeauRoue[];
  /** Index de la case où le doigt doit s'arrêter (décidé par le serveur). */
  caseCible: number | null;
  /** Nombre de tours complets avant l'arrêt. */
  tours?: number;
  /** Durée totale de l'animation, en secondes. */
  duree?: number;
  /** Appelé quand la roue est immobile. */
  onFin?: () => void;
  /** Largeur maximale en pixels. */
  taille?: number;
  /**
   * Plein cadre : la roue prend toute la largeur de sa colonne et jusqu'à
   * toute la hauteur de l'écran (`100dvh`), sans jamais créer de défilement.
   * Utilisé par l'écran à deux colonnes, où la roue occupe la colonne de
   * droite et les textes celle de gauche.
   */
  pleinEcran?: boolean;
  /**
   * Angle d'arrêt déjà connu (reprise après rechargement) : la roue s'affiche
   * immédiatement sur la bonne case au lieu de repartir de zéro. Sans cela,
   * un joueur qui rechargeait pendant la rotation voyait une roue neuve et
   * ne comprenait pas que son tour était déjà consommé.
   */
  angleInitial?: number | null;
  className?: string;
};

type Secteur = {
  cle: string;
  nom: string;
  icone: string;
  /** Photo du cadeau : si elle est là, la case n'affiche QUE l'image. */
  image: string | null;
  couleur: string;
  clair: string;
  fonce: string;
  couleurTexte: string;
  debut: number;
  angle: number;
  milieu: number;
  chemin: string;
};

export function Roue({
  cases,
  caseCible,
  tours = 6,
  duree = 6.5,
  onFin,
  taille,
  pleinEcran = false,
  angleInitial = null,
  className,
}: RoueProps) {
  /**
   * Rotation initiale : si un angle d'arrêt est fourni (tirage déjà joué), on
   * démarre dessus. `useState` fige la valeur au montage : Framer Motion ne
   * réinitialise pas la valeur entre deux rendus.
   */
  const rotation = useMotionValue(angleInitial ?? 0);
  const [enMouvement, setEnMouvement] = useState(false);
  /** Index actuellement sous le doigt (retour visuel pendant la rotation). */
  const [indexDoigt, setIndexDoigt] = useState<number | null>(() => {
    if (angleInitial === null || cases.length === 0) return null;
    const secteur = 360 / cases.length;
    const normalise = ((-(angleInitial % 360)) + 360) % 360;
    return Math.floor(normalise / secteur) % cases.length;
  });
  /** Incrémenté à chaque cloison franchie : fait claquer l'aiguille. */
  const [claquer, setClaquer] = useState(0);
  /**
   * URLs d'images qui n'ont pas pu s'afficher (lien mort, hébergement fermé,
   * faute de frappe dans l'administration). Une case dont la photo casse
   * retombe AUTOMATIQUEMENT sur son texte : mieux vaut un libellé qu'une case
   * de couleur vide, qui laisserait croire à un bug.
   */
  const [imagesCassees, setImagesCassees] = useState<Record<string, true>>({});
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);
  const rotationRef = useRef(angleInitial ?? 0);
  /** Horodatage de la dernière cloison franchie (rythme des claquements). */
  const tickRef = useRef(0);
  /** Décalage angulaire tiré au sort à chaque tour (voir angleCible). */
  const deriveRef = useRef(0);

  /** Géométrie + couleurs : recalculées seulement si les lots changent. */
  const secteurs = useMemo<Secteur[]>(() => {
    const angle = 360 / Math.max(cases.length, 1);
    return cases.map((c, i) => {
      const debut = i * angle;
      return {
        cle: `${c.id}-${i}`,
        nom: c.nom,
        icone: c.icone,
        image: imageAffichable(c.image_url),
        couleur: c.couleur,
        clair: nuancer(c.couleur, 1.34),
        fonce: nuancer(c.couleur, 0.66),
        couleurTexte: texteSur(c.couleur),
        debut,
        angle,
        milieu: debut + angle / 2,
        chemin: secteurPath(CENTRE, CENTRE, RAYON - 10, debut, debut + angle),
      };
    });
  }, [cases]);

  /** Suit la rotation : quel secteur est sous le doigt ? */
  useEffect(() => {
    return rotation.on("change", (valeur) => {
      rotationRef.current = valeur;
      if (!cases.length) return;
      const secteur = 360 / cases.length;
      const normalise = ((-valeur % 360) + 360) % 360;
      setIndexDoigt(Math.floor(normalise / secteur) % cases.length);
    });
  }, [rotation, cases.length]);

  useEffect(() => () => animationRef.current?.stop(), []);

  const lancer = useCallback(() => {
    if (caseCible === null || cases.length === 0) return;

    animationRef.current?.stop();
    setEnMouvement(true);

    const depart = rotationRef.current;
    const base = depart - (depart % 360);
    const arrivee = base + angleCible(caseCible, cases.length, tours, deriveRef.current);

    let dernierIndex = -1;
    let intervalle = 1000; // ms entre deux cloisons franchie

    animationRef.current = animate(rotation, arrivee, {
      duration: duree,
      /**
       * easeOutQuint : la roue garde sa vitesse presque jusqu'au bout puis
       * meurt lentement. C'est la courbe d'une roue lestée.
       */
      ease: [0.09, 0.62, 0.03, 1],
      onUpdate: (valeur) => {
        const secteur = 360 / cases.length;
        const index = Math.floor(Math.abs(valeur - base) / secteur);
        if (index === dernierIndex) return;

        const maintenant = performance.now();
        const ecart = dernierIndex < 0 ? 0 : maintenant - tickRef.current;
        dernierIndex = index;
        tickRef.current = maintenant;
        if (ecart > 16 && ecart < 600) intervalle = ecart;

        // L'aiguille ne claque que tant que la roue tourne assez vite : à la
        // toute fin, le ressort n'aurait pas le temps de se replacer.
        if (intervalle < 260) setClaquer((n) => n + 1);

        // Le son suit la vitesse : fort au début, presque inaudible à la fin.
        jouerTic(Math.min(1, Math.max(0.12, 210 / Math.max(intervalle, 1))));
      },
      onComplete: () => {
        setEnMouvement(false);
        setIndexDoigt(caseCible);
        onFin?.();
      },
    });
  }, [caseCible, cases.length, duree, onFin, rotation, tours]);

  /** Tirage du décalage, puis lancement (après la réponse du serveur). */
  useEffect(() => {
    if (caseCible === null) return;
    deriveRef.current = Math.random() * 2 - 1;
    const id = setTimeout(lancer, 0);
    return () => clearTimeout(id);
  }, [caseCible, lancer]);

  const secteurCourant = indexDoigt !== null ? (secteurs[indexDoigt]?.nom ?? null) : null;

  return (
    <div
      className={`relative mx-auto aspect-square w-full select-none ${className ?? ""}`}
      style={
        pleinEcran
          ? {
              // Le carré est piloté par le PARENT, qui connaît l'écran (voir
              // EcranRoue : `h-[min(100dvh,60vw)] w-[...]`). Ici on remplit
              // simplement ce carré : une seule source de vérité, aucune
              // largeur nulle possible, aucune déformation.
              width: "100%",
              maxWidth: "100%",
              aspectRatio: "1 / 1",
            }
          : { maxWidth: taille ?? 350 }
      }
    >
      {/* Halo : la roue semble éclairée par derrière */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-[12%] -z-10 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(255,217,119,0.34) 0%, rgba(179,18,31,0.20) 42%, rgba(47,122,83,0.14) 62%, transparent 72%)",
        }}
      />

      <svg
        viewBox={`0 0 ${TAILLE} ${TAILLE}`}
        className="h-full w-full drop-shadow-[0_25px_45px_rgba(0,0,0,0.8)]"
        role="img"
        aria-label="Roue de Noël"
      >
        <defs>
          {secteurs.map((s) => (
            <linearGradient
              key={`grad-${s.cle}`}
              id={`g-${s.cle}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.clair} />
              <stop offset="52%" stopColor={s.couleur} />
              <stop offset="100%" stopColor={s.fonce} />
            </linearGradient>
          ))}

          {/* Jante : anneau métallique à facettes */}
          <linearGradient id="jante" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff6d2" />
            <stop offset="14%" stopColor="#ffd977" />
            <stop offset="30%" stopColor="#a9822b" />
            <stop offset="42%" stopColor="#e8c66a" />
            <stop offset="54%" stopColor="#b3121f" />
            <stop offset="62%" stopColor="#ffeeb4" />
            <stop offset="78%" stopColor="#2f7a53" />
            <stop offset="88%" stopColor="#7a5a14" />
            <stop offset="100%" stopColor="#f8e7a8" />
          </linearGradient>

          {/* Moyeu : dôme doré */}
          <radialGradient id="moyeu" cx="38%" cy="32%" r="72%">
            <stop offset="0%" stopColor="#fffbe8" />
            <stop offset="30%" stopColor="#ffd977" />
            <stop offset="60%" stopColor="#c9a227" />
            <stop offset="84%" stopColor="#b3121f" />
            <stop offset="100%" stopColor="#5c0810" />
          </radialGradient>

          {/* Doigt / aiguille */}
          <linearGradient id="doigt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fffdf3" />
            <stop offset="42%" stopColor="#f2d68d" />
            <stop offset="100%" stopColor="#b0812a" />
          </linearGradient>

          {/* Reflet vitreux qui balaie la roue */}
          <linearGradient id="vitre" x1="0" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.32)" />
            <stop offset="34%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="62%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.10)" />
          </linearGradient>

          <filter id="ombreDoigt" x="-80%" y="-80%" width="260%" height="260%">
            <feDropShadow dx="0" dy="4" stdDeviation="3.2" floodColor="#000" floodOpacity="0.7" />
          </filter>

          {/* Éclat des ampoules */}
          <filter id="haloAmpoule" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="2.6" result="flou" />
            <feMerge>
              <feMergeNode in="flou" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Voile laqué : lumière en haut, ombre en bas du secteur */}
          <linearGradient id="voile" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.30)" />
            <stop offset="42%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="70%" stopColor="rgba(0,0,0,0.10)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.34)" />
          </linearGradient>

          <radialGradient id="vignette" cx="50%" cy="50%" r="50%">
            <stop offset="72%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
          </radialGradient>
        </defs>

        {/* ── Jante extérieure ─────────────────────────────────────────── */}
        <circle cx={CENTRE} cy={CENTRE} r={RAYON} fill="url(#jante)" />
        <circle cx={CENTRE} cy={CENTRE} r={RAYON - 3} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="1.2" />
        <circle cx={CENTRE} cy={CENTRE} r={RAYON - 9} fill="#081711" />
        <circle cx={CENTRE} cy={CENTRE} r={RAYON - 9} fill="none" stroke="rgba(255,246,210,0.28)" strokeWidth="0.8" />

        {/* ── Partie tournante ─────────────────────────────────────────── */}
        <motion.g
          style={{
            rotate: rotation, // ← NOMBRE de degrés (jamais "rotate(Xdeg)")
            transformOrigin: `${CENTRE}px ${CENTRE}px`,
            willChange: "transform",
          }}
        >
          {/* Secteurs rayés */}
          {secteurs.map((s) => (
            <g key={s.cle}>
              <path d={s.chemin} fill={`url(#g-${s.cle})`} stroke="rgba(0,0,0,0.28)" strokeWidth="0.7" />
              {/* Voile laqué : un dégradé clair en haut du secteur seulement —
                  deux tons suffisent, au-delà la roue devient illisible. */}
              <path d={s.chemin} fill="url(#voile)" opacity="0.5" />
            </g>
          ))}

          {/* Ampoules sur le pourtour : elles clignotent en alternance quand
              la roue tourne (animation CSS, donc aucune valeur au rendu). */}
          {secteurs.map((s, i) => {
            const rad = ((s.milieu - 90) * Math.PI) / 180;
            const r = RAYON - 15;
            // Guirlande : or, rouge de Noël, givre — comme un vrai sapin.
            const teinte = i % 3 === 0 ? "#ffd977" : i % 3 === 1 ? "#ff5a68" : "#d8f2e9";
            return (
              <circle
                key={`amp-${s.cle}`}
                cx={CENTRE + r * Math.cos(rad)}
                cy={CENTRE + r * Math.sin(rad)}
                r={2.8}
                fill={teinte}
                filter="url(#haloAmpoule)"
                className={enMouvement ? "ampoule-roue" : undefined}
                opacity={enMouvement ? undefined : 0.62}
                style={enMouvement ? { animationDelay: `${(i % 3) * 0.18}s` } : undefined}
              />
            );
          })}

          {/* Une case affiche SOIT le texte, SOIT l'image du cadeau.
              Jamais les deux : une photo et un libellé dans un secteur de
              45° se chevauchaient, et une vignette + un texte donnaient
              l'impression d'une roue surchargée. Le choix appartient à
              l'exploitant : il met une photo dans la fiche du cadeau, ou il
              n'en met pas. */}
          {secteurs.map((s) =>
            s.image && !imagesCassees[s.image] ? (
              <Vignette
                key={`img-${s.cle}`}
                secteur={s}
                onCasse={() => {
                  const url = s.image;
                  if (!url) return;
                  setImagesCassees((etat) => ({ ...etat, [url]: true }));
                }}
              />
            ) : (
              <Libelle key={`lib-${s.cle}`} secteur={s} />
            ),
          )}

          {/* Reflet vitreux */}
          <circle cx={CENTRE} cy={CENTRE} r={RAYON - 10} fill="url(#vitre)" />
          <circle cx={CENTRE} cy={CENTRE} r={RAYON - 10} fill="url(#vignette)" />
        </motion.g>

        {/* ── Doigt (aiguille) : ressort qui claque ────────────────────── */}
        <g filter="url(#ombreDoigt)">
          <motion.g
            key={claquer}
            style={{ transformOrigin: `${CENTRE}px ${CENTRE - 14}px` }}
            initial={{ rotate: enMouvement ? 13 : 0 }}
            animate={{ rotate: 0 }}
            transition={{ type: "spring", stiffness: 700, damping: 13, mass: 0.35 }}
          >
            {/* Corps du doigt */}
            <path
              d={`M ${CENTRE} ${CENTRE - 6}
                  L ${CENTRE + 12.5} ${CENTRE - 46}
                  Q ${CENTRE} ${CENTRE - 74} ${CENTRE - 12.5} ${CENTRE - 46} Z`}
              fill="url(#doigt)"
              stroke="#6b4f11"
              strokeWidth="1.1"
            />
            {/* Liseré lumineux */}
            <path
              d={`M ${CENTRE} ${CENTRE - 16}
                  L ${CENTRE + 5} ${CENTRE - 44}
                  L ${CENTRE} ${CENTRE - 62}
                  L ${CENTRE - 5} ${CENTRE - 44} Z`}
              fill="rgba(255,255,255,0.55)"
            />
          </motion.g>
        </g>

        {/* ── Moyeu ────────────────────────────────────────────────────── */}
        <circle cx={CENTRE} cy={CENTRE} r={30} fill="url(#jante)" />
        <circle cx={CENTRE} cy={CENTRE} r={26} fill="url(#moyeu)" />
        <circle cx={CENTRE} cy={CENTRE} r={26} fill="none" stroke="rgba(93,68,16,0.6)" strokeWidth="1" />
        <text
          x={CENTRE}
          y={CENTRE + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9.5}
          fontWeight={800}
          letterSpacing="0.5"
          fill="#5d4410"
          style={{ fontFamily: "Cinzel, serif", pointerEvents: "none" }}
        >
          {enMouvement ? "…" : "ROUE"}
        </text>

        {/* Reflet du verre sur le moyeu */}
        <ellipse cx={CENTRE - 8} cy={CENTRE - 9} rx={9} ry={5} fill="rgba(255,255,255,0.5)" />
      </svg>

      {/*
        Étiquette : ce que le doigt survole / désigne. Elle est posée À
        L'INTÉRIEUR du carré (bottom-0) : collée en dessous (-bottom-5), elle
        allongeait la page de ~28 px et créait un défilement parasite.
      */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
        <span className="max-w-[86%] truncate rounded-full border border-or/35 bg-sapin/90 px-3.5 py-1 text-[10.5px] font-bold tracking-[0.14em] text-or-clair uppercase shadow-lg backdrop-blur">
          {enMouvement ? "La roue tourne…" : (secteurCourant ?? "Joyeux Noël")}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Libellé incurvé : le texte suit le bord, comme sur une vraie roue          */
/* -------------------------------------------------------------------------- */
/**
 * Version courte d'un nom de lot, pour les roues à beaucoup de cases.
 *
 * À 20 cases, un secteur ne fait que 18° : impossible d'y écrire « Échantillon
 * parfum » sans que le texte sorte du cercle. On garde donc le mot porteur
 * (« CASQUETTE », « PARFUM »), en privilégiant un nombre ou un pourcentage
 * quand il y en a un — c'est l'information que le client cherche.
 */
export function nomCourt(nom: string): string {
  const nettoye = nom.trim();
  const nombre = nettoye.match(/-?\d[\d\s\u00a0\u202f.,]*\s*(%|FCFA|CFA|€)?/i);
  if (nombre && nombre[0].trim().length >= 2) {
    const brut = nombre[0].trim().replace(/\s+/g, " ");
    // « 5 000 FCFA » ou « 10 % » : plus parlant que le nom du lot.
    return /FCFA|CFA|€/i.test(brut) || /%/.test(brut) ? brut : brut;
  }
  const mots = nettoye.split(/\s+/).filter((m) => m.length > 2);
  if (mots.length === 0) return nettoye;
  const vide = new Set(["de", "du", "des", "la", "le", "les", "un", "une", "aux", "a", "au", "et"]);
  const porteurs = mots.filter((m) => !vide.has(m.toLowerCase()));
  // Le mot le plus long est en général le plus identifiable.
  return (porteurs.length ? porteurs : mots).sort((a, b) => b.length - a.length)[0];
}

/**
 * Case IMAGE : la photo du cadeau remplit tout le secteur, et rien d'autre.
 *
 * Règle demandée par l'exploitant — « soit du texte, soit l'image » : une case
 * affiche l'un OU l'autre, jamais un mélange. Une case avec photo n'a donc ni
 * libellé incurvé, ni petite icône, ni fond de couleur visible : le nom du lot
 * reste accessible juste en dessous de la roue (l'étiquette qui suit le doigt)
 * et dans la popup de résultat.
 *
 * Mise en œuvre : le secteur est ramené à la verticale par une rotation, puis
 * une image rectangulaire assez large pour couvrir l'ouverture angulaire y est
 * posée (`preserveAspectRatio: slice`). Le `clipPath` en camembert garantit que
 * la photo ne déborde jamais sur la case voisine.
 */
function Vignette({ secteur, onCasse }: { secteur: Secteur; onCasse: () => void }) {
  const rayonExt = RAYON - 10;
  const marge = 0.9; // degrés : laisse respirer la cloison entre deux cases
  const debut = secteur.debut + marge;
  const fin = secteur.debut + secteur.angle - marge;
  const chemin = secteurPath(CENTRE, CENTRE, rayonExt, debut, fin);
  const idClip = `clip-${secteur.cle}`;

  // Largeur nécessaire pour couvrir l'ouverture du secteur (le triangle va en
  // s'évasant) : la corde au bord extérieur, plus une marge de sécurité.
  const largeur = 2 * rayonExt * Math.sin((secteur.angle * Math.PI) / 360) * 1.12;

  return (
    <g>
      <defs>
        <clipPath id={idClip}>
          <path d={chemin} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${idClip})`}>
        {/* Rotation : le secteur pointe alors vers le haut du repère, et une
            simple image verticale le couvre entièrement. */}
        <g transform={`rotate(${secteur.milieu} ${CENTRE} ${CENTRE})`}>
          <image
            href={secteur.image ?? undefined}
            x={CENTRE - largeur / 2}
            y={CENTRE - rayonExt}
            width={largeur}
            height={rayonExt}
            preserveAspectRatio="xMidYMid slice"
            style={{ pointerEvents: "none" }}
            // Un SVG <image> déclenche bien `error` : on bascule alors la case
            // en mode texte (voir `imagesCassees` dans le composant Roue).
            onError={onCasse}
          />
        </g>
        {/* Voile léger : garde les cloisons et l'aiguille lisibles même sur une
            photo très claire (un ciel, un fond blanc). */}
        <path d={chemin} fill="url(#voile)" opacity="0.32" />
      </g>

      {/* Liseré interne : détache la case de sa voisine sur les photos sombres. */}
      <path d={chemin} fill="none" stroke="rgba(255,246,210,0.18)" strokeWidth="0.7" />
    </g>
  );
}

function Libelle({ secteur }: { secteur: Secteur }) {
  const compact = secteur.angle < 26;
  const libelle = compact ? nomCourt(secteur.nom) : secteur.nom;
  const lignes = decouper(libelle, compact ? 9 : 14);
  const taille = compact ? 8.5 : lignes.length > 1 ? 10 : 11.5;
  /** Rayon du centre du libellé : milieu de la couronne, jamais sur le bord. */
  const rayon = RAYON * (compact ? 0.68 : 0.60);
  const retourner = secteur.milieu > 180;
  const ecart = taille + 1.4;
  const premierDy = lignes.length > 1 ? -ecart / 2 : 0;
  const icone = compact ? 13 : 15;

  return (
    <g transform={`rotate(${secteur.milieu} ${CENTRE} ${CENTRE})`}>
      {/* Icône : vers le moyeu, toujours à l'endroit. Ce sont des icônes
          vectorielles, pas des emoji : ils s'affichent à l'identique sur tous
          les téléphones (beaucoup, surtout en Afrique de l'Ouest, ne rendent
          pas les emoji récents). */}
      <g
        transform={`translate(${CENTRE - icone / 2} ${CENTRE - RAYON * (compact ? 0.3 : 0.33) - icone / 2})`}
        opacity={0.92}
      >
        <IconeCadeau nom={secteur.nom} taille={icone} couleur={secteur.couleurTexte} />
      </g>

      {/**
       * Un SEUL <text> pour toutes les lignes (des <tspan> décalés en dy) :
       * deux <text> séparés finissent par se superposer selon l'angle.
       *
       * `textAnchor="middle"` répartit le texte de part et d'autre du point
       * d'ancrage, qui ne peut donc pas déborder du cercle (contrairement à
       * « start »/« end », qui poussaient les libellés longs hors de la roue).
       */}
      <text
        x={CENTRE}
        y={CENTRE - rayon}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={secteur.couleurTexte}
        fontSize={taille}
        fontWeight={800}
        letterSpacing="0.02em"
        transform={`rotate(${retourner ? 90 : -90} ${CENTRE} ${CENTRE - rayon})`}
        style={{
          fontFamily: "Manrope Variable, system-ui, sans-serif",
          pointerEvents: "none",
          textShadow: "0 1px 2px rgba(0,0,0,0.75)",
        }}
      >
        {lignes.map((ligne, i) => (
          <tspan key={i} x={CENTRE} dy={i === 0 ? premierDy : ecart}>
            {ligne.toUpperCase()}
          </tspan>
        ))}
      </text>
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function point(cx: number, cy: number, rayon: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return {
    x: Number((cx + rayon * Math.cos(rad)).toFixed(2)),
    y: Number((cy + rayon * Math.sin(rad)).toFixed(2)),
  };
}

/**
 * Une URL d'image est-elle affichable dans la roue ?
 *
 * On n'accepte que http(s) et les chemins locaux : une URL `javascript:` ou
 * `data:` saisie par erreur (ou par malveillance) ne doit jamais finir dans un
 * attribut `href` du SVG. Une valeur refusée retombe proprement sur le texte.
 */
function imageAffichable(url: string | null | undefined): string | null {
  if (!url) return null;
  const valeur = url.trim();
  if (valeur.startsWith("/")) return valeur;
  if (/^https?:\/\//i.test(valeur)) return valeur;
  return null;
}

/** Chemin SVG d'un secteur (part du centre). */
function secteurPath(
  cx: number,
  cy: number,
  rayon: number,
  debutDeg: number,
  finDeg: number,
): string {
  const a = point(cx, cy, rayon, debutDeg);
  const b = point(cx, cy, rayon, finDeg);
  const grandArc = finDeg - debutDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${a.x} ${a.y} A ${rayon} ${rayon} 0 ${grandArc} 1 ${b.x} ${b.y} Z`;
}

/**
 * Coupe un libellé en deux lignes lisibles.
 *
 * Deux précautions :
 *  • on ne coupe JAMAIS entre deux nombres (« 5 000 » doit rester d'un bloc) ;
 *  • on choisit la coupure qui équilibre le mieux les deux lignes, plutôt que
 *    de remplir la première au maximum.
 */
export function decouper(texte: string, max: number): string[] {
  if (texte.length <= max) return [texte];

  const mots = texte.split(" ").filter(Boolean);
  if (mots.length < 2) return [texte];

  const estNombre = (m: string) => /^[\d\u00a0\u202f.,%€-]+$/.test(m);
  let meilleur = -1;
  let meilleurEcart = Infinity;

  for (let i = 1; i < mots.length; i += 1) {
    const avant = mots.slice(0, i).join(" ");
    const apres = mots.slice(i).join(" ");
    if (avant.length > max || apres.length > max) continue;
    // Ne pas séparer « 5 » de « 000 ».
    if (estNombre(mots[i - 1]) && estNombre(mots[i])) continue;
    const ecart = Math.abs(avant.length - apres.length);
    if (ecart < meilleurEcart) {
      meilleurEcart = ecart;
      meilleur = i;
    }
  }

  if (meilleur === -1) return [texte];
  return [mots.slice(0, meilleur).join(" "), mots.slice(meilleur).join(" ")];
}

/** Texte clair ou sombre selon la luminosité du fond. */
function texteSur(hex: string): string {
  const propre = hex.replace("#", "");
  const r = parseInt(propre.slice(0, 2), 16);
  const g = parseInt(propre.slice(2, 4), 16);
  const b = parseInt(propre.slice(4, 6), 16);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance > 132 ? "#140f0a" : "#fffaf0";
}
