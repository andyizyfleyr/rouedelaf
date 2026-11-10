"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Gift,
  Loader2,
  MapPin,
  Sparkles,
  Ticket,
  TriangleAlert,
} from "lucide-react";

import { PopupResultat } from "@/components/client/PopupResultat";
import { Roue } from "@/components/roue/Roue";
import { entetesJeu } from "@/lib/appareil";
import { suivreEvenement } from "@/lib/pixel";
import { angleCible } from "@/lib/roue";
import { deverrouillerAudio } from "@/lib/sons";
import type { CadeauRoue, ResultatTirageApi, TirageResultat } from "@/lib/types";

/**
 * /roue — DEUX COLONNES : la roue à droite, les textes et le bouton à gauche.
 *
 * La roue se dimensionne sur la HAUTEUR DE L'ÉCRAN (`100dvh`), pas sur une
 * largeur fixe : c'est ce qui la rend vraiment grande sur ordinateur et
 * tablette, où elle occupait avant un petit carré au milieu du vide.
 *
 * Adaptation :
 *  - `sm` et plus (ordinateur, tablette, téléphone en paysage) : deux
 *    colonnes, textes à gauche, roue à droite ;
 *  - téléphone en portrait : une seule colonne (textes, roue, bouton). Deux
 *    colonnes sur 390 px écraseraient la roue et rendraient les libellés
 *    illisibles ; la roue prend toute la largeur, le maximum possible.
 *
 * Le résultat est décidé AVANT l'animation (le serveur renvoie `caseIndex`) :
 * le doigt s'arrête exactement dessus, impossible de tricher côté navigateur.
 *
 * ⚠️ Aucune redirection automatique : dès que la roue s'immobilise, la popup
 * de résultat s'ouvre par-dessus. On reste sur /roue.
 *
 * ⚠️ Reprise après rechargement : si le joueur recharge en pleine rotation (ou
 * revient plus tard), `tirageInitial` porte le tirage déjà enregistré et la
 * roue s'affiche directement sur la bonne case, popup ouverte. Le tour n'est
 * jamais « perdu » silencieusement.
 */
export function EcranRoue({
  cases,
  nom,
  toursRestants,
  toursBonus = 0,
  tiragesInitiaux,
  qrInitial,
  messagePerdu,
  jeuOuvert,
  lotsDisponibles,
  messageFermeture,
  boutique,
}: {
  cases: CadeauRoue[];
  nom: string;
  toursRestants: number;
  /** Tours gagnés en parrainant, encore non consommés. */
  toursBonus?: number;
  /** Tous les tirages déjà joués (du plus récent au plus ancien). */
  tiragesInitiaux: TirageResultat[];
  /** QR du dernier tirage gagné, préparé côté serveur. */
  qrInitial: string | null;
  messagePerdu: string;
  /** Le jeu est-il ouvert (réglage admin) ? */
  jeuOuvert: boolean;
  /** Reste-t-il au moins un lot en stock ? */
  lotsDisponibles: boolean;
  /** Raison affichée quand on ne peut pas jouer (jeu fermé ou stock épuisé). */
  messageFermeture: string;
  boutique: { nom: string; adresse: string; whatsapp: string };
}) {
  const [chargement, setChargement] = useState(false);
  const [cible, setCible] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  /** Ancre du message d'erreur : sur mobile il est au-dessus de la roue,
   *  hors écran quand on vient de toucher le bouton. On le ramène. */
  const refErreur = useRef<HTMLParagraphElement | null>(null);
  const [resultat, setResultat] = useState<ResultatTirageApi | null>(null);
  /** La roue est immobile : la popup de résultat peut s'ouvrir. */
  const [arretee, setArretee] = useState(false);
  /**
   * OUVERTE D'EMBLÉE si le joueur a déjà consommé son tour : c'est le cas d'un
   * rechargement pendant la rotation (ou d'un retour plus tard). Il a un
   * cadeau, il doit le voir sans avoir à deviner qu'un bouton le cache.
   * S'il lui reste des tours (parrainage), on la laisse fermée : il va rejouer.
   */
  const [popup, setPopup] = useState(tiragesInitiaux.length > 0 && toursRestants <= 0);
  const [mesTirages, setMesTirages] = useState<TirageResultat[]>(tiragesInitiaux);
  /** Index dans `mesTirages` du cadeau affiché dans la popup. */
  const [choix, setChoix] = useState(0);
  const dejaLance = useRef(false);
  const [relance, setRelance] = useState(0);

  /** Tirage issu de la réponse API, mis à la même forme que ceux du serveur. */
  const tirageDeLaReponse: TirageResultat | null = resultat
    ? {
        id: resultat.tirageId,
        statut: resultat.statut,
        code_unique: resultat.code,
        recupere: false,
        expire_le: resultat.expireLe ?? new Date().toISOString(),
        created_at: new Date().toISOString(),
        cadeau_nom: resultat.cadeau?.nom ?? null,
        cadeau_couleur: resultat.cadeau?.couleur ?? null,
        cadeau_icone: resultat.cadeau?.icone ?? null,
        cadeau_description: null,
        cadeau_image_url: null,
        reduction_consolation: resultat.reductionConsolation,
      }
    : null;

  /**
   * Liste affichable : le tirage qui vient d'être joué en tête (sa réponse
   * contient le QR frais), puis ceux chargés au démarrage. Les doublons sont
   * écartés par identifiant.
   */
  const liste: TirageResultat[] = tirageDeLaReponse
    ? [tirageDeLaReponse, ...mesTirages.filter((t) => t.id !== tirageDeLaReponse.id)]
    : mesTirages;

  const tirageAffiche = liste[choix] ?? null;
  const peutVoirResultat = tirageAffiche !== null;
  const qrAffiche = tirageAffiche && resultat && tirageAffiche.id === resultat.tirageId
    ? (resultat.qrDataUrl ?? qrInitial)
    : tirageAffiche?.id === mesTirages[0]?.id
      ? qrInitial
      : null;

  const enVol = cible !== null && !arretee;

  /**
   * Angle d'arrêt quand le résultat est déjà connu : on aligne la roue sur la
   * case du tirage sans animation — l'aiguille montre le vrai résultat.
   */
  const angleConnu =
    resultat === null && cible === null && tiragesInitiaux.length > 0 && cases.length > 0
      ? angleCible(caseIndexDeTirages(tiragesInitiaux[0], cases), cases.length, 0, 0)
      : null;

  const rechargerMesTirages = useCallback(async () => {
    try {
      const res = await fetch("/api/tirage", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.tirages) && data.tirages.length > 0) {
        setMesTirages(data.tirages as TirageResultat[]);
        setChoix(0);
        setPopup(true);
      }
    } catch {
      /* réseau instable : le message d'erreur déjà affiché suffit */
    }
  }, []);

  const tourner = useCallback(async () => {
    if (chargement || enVol || dejaLance.current) return;
    dejaLance.current = true;
    setErreur(null);
    setChargement(true);
    deverrouillerAudio();

    try {
      const res = await fetch("/api/tirage", { method: "POST", headers: entetesJeu() });
      const data = await res.json();

      if (!res.ok) {
        setErreur(data.erreur ?? "Le tirage n'a pas pu démarrer.");
        setChargement(false);
        dejaLance.current = false;
        // Plus de tours (double onglet, rechargement…) : on rafraîchit la
        // liste pour afficher le cadeau déjà gagné au lieu de laisser le
        // joueur devant un bouton qui échoue.
        if (data.code === "TOURS_EPUISES") void rechargerMesTirages();
        return;
      }

      const resultatApi = data as ResultatTirageApi;
      setResultat(resultatApi);
      setChoix(0);
      setCible(resultatApi.caseIndex);
      setChargement(false);
      suivreEvenement("joue_debut", { etape: "tirage" });
    } catch {
      setErreur("Connexion instable. Vérifiez votre réseau et réessayez.");
      setChargement(false);
      dejaLance.current = false;
    }
  }, [chargement, enVol, rechargerMesTirages]);

  /**
   * F3 — un message d'erreur doit être VU. Sur un téléphone, l'encart est
   * au-dessus de la roue alors que le bouton est en dessous : sans ce
   * défilement, l'erreur s'affichait hors champ et le joueur croyait que le
   * bouton ne répondait pas.
   */
  useEffect(() => {
    if (!erreur) return;
    refErreur.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [erreur]);

  /**
   * La roue vient de s'immobiliser : on ouvre la popup de résultat TOUT DE
   * SUITE. Le tour est terminé, le cadeau doit s'afficher — sans pour autant
   * quitter la page.
   */
  const surFin = useCallback(() => {
    setArretee(true);
    setPopup(true);
  }, []);

  /**
   * Peut-on lancer un tirage ? Trois verrous, tous affichés AVANT le clic :
   * plus de tour, jeu fermé par l'admin, plus aucun lot en stock. Avant, il
   * fallait appuyer sur le bouton pour découvrir que le jeu était fermé ou
   * que la roue ne contenait plus que des cases « Perdu ».
   */
  const jeuIndisponible = !jeuOuvert || !lotsDisponibles;
  /** Un nom de plus de 18 caractères ne tient pas sur une ligne de titre. */
  const nomLong = nom.trim().length > 18;
  const peutTourner = toursRestants > 0 && !resultat && !jeuIndisponible;
  const titreBouton = chargement
    ? "Préparation…"
    : enVol
      ? "La roue tourne…"
      : resultat
        ? "Voir mon cadeau"
        : peutTourner
          ? "Tourner la roue"
          : jeuIndisponible
            ? "Roue en recharge"
            : "Revoir mon cadeau";

  function actionBouton() {
    if (resultat && (arretee || !enVol)) {
      setPopup(true);
      return;
    }
    if (peutTourner) {
      void tourner();
      return;
    }
    setPopup(true);
  }

  return (
    <div className="grid min-h-0 w-full flex-1 grid-cols-1 content-center justify-items-center gap-3 px-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:grid-rows-[auto_1fr] sm:content-center sm:items-center sm:justify-items-start sm:gap-x-14 sm:gap-y-4 sm:px-12 sm:py-6">
      {/* ————— TEXTES ————— */}
      <div className="flex w-full min-w-0 flex-col items-center gap-2 px-4 pt-2 text-center sm:col-start-1 sm:row-start-1 sm:max-w-[30rem] sm:items-start sm:gap-3 sm:px-0 sm:pt-0 sm:text-left">
        <span
          className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] leading-tight font-semibold tracking-[0.16em] uppercase sm:px-3 sm:py-1 sm:text-[10.5px] ${
            jeuIndisponible && !resultat
              ? "border-cendre/25 bg-white/[0.04] text-cendre/70"
              : "border-or/30 bg-or/[0.07] text-or-clair/85"
          }`}
        >
          <Sparkles className="size-2.5 shrink-0 sm:size-3" />
          {/* Pas de « cadeau garanti » quand il n'y a plus de cadeau. */}
          <span>
            {jeuIndisponible && !resultat
              ? "Roue en recharge"
              : toursBonus > 0 && toursRestants > 0
                ? // Tour gagné en parrainant : on le dit explicitement, sinon le
                  // parrain ne comprend pas pourquoi le bouton lui propose de
                  // rejouer alors qu'il croyait avoir fini.
                  // On compte UNIQUEMENT les tours de parrainage : le tour de
                  // base ne se « gagne » pas, l'annoncer était trompeur
                  // (« +3 tours » pour 2 bonus + 1 tour offert).
                  `+${toursBonus} tour${toursBonus > 1 ? "s" : ""} gagné${toursBonus > 1 ? "s" : ""} · merci !`
                : `${toursRestants > 1 ? `${toursRestants} tours` : "1 tour offert"} · cadeau garanti`}
          </span>
        </span>

        {/*
          Nom long : « Aboubakar Siddiq Ouedraogo de Souza » prenait trois
          lignes sur un téléphone et poussait la roue hors de l'écran. On
          réduit la taille au-delà de ~18 caractères et on limite à deux
          lignes, avec une ellipse propre (le nom complet reste dans le
          `title`, et sur /resultat qui l'affiche en entier).
        */}
        <h1
          title={nom}
          className={`texte-or font-titre line-clamp-2 leading-[1.06] font-bold tracking-[0.02em] uppercase sm:line-clamp-3 ${
            nomLong ? "text-[15px] sm:text-[clamp(20px,1.9vw,28px)]" : "text-[19px] sm:text-[clamp(22px,2.2vw,32px)]"
          }`}
        >
          {nom},
          <br />
          <span className="text-[15px] tracking-[0.06em] sm:text-[clamp(17px,1.6vw,24px)]">
            {peutTourner || resultat ? "à vous de jouer" : "voici votre cadeau"}
          </span>
        </h1>

        <p className="max-w-[34ch] text-[10.5px] leading-snug text-cendre/70 sm:text-[13px]">
          {peutTourner
            ? "Tournez la roue et découvrez votre cadeau. Un seul tour par personne."
            : jeuIndisponible && !resultat
              ? messageFermeture
              : "Votre tour est terminé. Retrouvez votre cadeau ci-dessous."}
        </p>

        {erreur && (
          <motion.p
            ref={refErreur}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            role="alert"
            className="flex w-full max-w-[38ch] items-start gap-2 rounded-lg border border-rose-300/50 bg-rose-950/70 px-3 py-2.5 text-[13px] leading-snug font-semibold text-rose-50 shadow-[0_6px_24px_-8px_rgba(0,0,0,0.7)] sm:text-[14px]"
          >
            <TriangleAlert className="mt-px size-5 shrink-0" aria-hidden />
            <span>{erreur}</span>
          </motion.p>
        )}

        {/* Rappel boutique : seulement quand la colonne a la place. */}
        <div className="mt-1 hidden w-full flex-col gap-2 border-t border-or/15 pt-3 text-[11.5px] leading-snug text-cendre/60 lg:flex">
          <span className="flex items-start gap-2">
            <MapPin className="mt-px size-3.5 shrink-0 text-or/70" />
            <span>
              {boutique.nom}
              <br />
              <span className="text-cendre/45">{boutique.adresse}</span>
            </span>
          </span>
          <span className="flex items-center gap-2">
            <Ticket className="size-3.5 shrink-0 text-or/70" />
            Présentez le code en boutique
          </span>
        </div>
      </div>

      {/* ————— LA ROUE ————— */}
      <div className="order-2 flex min-h-0 min-w-0 items-center justify-center sm:order-none sm:col-start-2 sm:row-span-2 sm:row-start-1">
        {/*
          La roue prend le plus grand carré possible : toute la hauteur de
          l'écran (`100dvh` moins le cadre), plafonnée par la place laissée aux
          textes (62 % de la largeur) sur les écrans très larges, où 56vw
          laissait de grandes marges noires.
        */}
        <div className="h-[min(calc(100dvh-11rem),100vw)] w-[min(calc(100dvh-11rem),100vw)] sm:h-[min(calc(100dvh-3rem),62vw,900px)] sm:w-[min(calc(100dvh-3rem),62vw,900px)]">
          <Roue
            key={relance}
            cases={cases}
            caseCible={cible}
            onFin={surFin}
            tours={6}
            duree={6.6}
            taille={420}
            pleinEcran
            angleInitial={angleConnu}
          />
        </div>
      </div>

      {/* ————— LE BOUTON + navigation entre les cadeaux ————— */}
      <div className="order-3 w-full shrink-0 px-4 sm:order-none sm:col-start-1 sm:row-start-2 sm:self-start sm:px-0">
        <button
          type="button"
          onClick={actionBouton}
          disabled={chargement || enVol || (jeuIndisponible && !resultat && mesTirages.length === 0)}
          className="btn-or w-full !px-2.5 !py-3 text-[14px] sm:!py-3.5 sm:text-[15px]"
        >
          {chargement || enVol ? (
            <>
              <Loader2 className="size-4 shrink-0 animate-spin" />
              <span className="min-w-0 leading-tight">{titreBouton}</span>
            </>
          ) : (
            <>
              <Gift className="size-4 shrink-0" />
              {/* Pas de `truncate` : sur 320 px le libellé se coupait
                  (« Tourner la … »). On autorise deux lignes. */}
              <span className="min-w-0 leading-tight">{titreBouton}</span>
            </>
          )}
        </button>

        {/*
          Plusieurs cadeaux : le joueur doit pouvoir revenir au premier. Sans
          ces flèches, gagner un deuxième lot rendait le premier inaccessible
          (son code restait valide mais n'était plus affichable nulle part).
        */}
        {liste.length > 1 && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-or/20 bg-black/25 px-1.5 py-1">
            <button
              type="button"
              aria-label="Cadeau précédent"
              onClick={() => {
                setChoix((c) => (c + 1) % liste.length);
                setRelance((n) => n + 1);
              }}
              className="grid size-8 place-items-center rounded-md text-cendre/70 hover:bg-white/5 hover:text-creme"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setPopup(true)}
              className="min-w-0 flex-1 text-center text-[10.5px] leading-tight tracking-[0.08em] text-or-clair/85 uppercase"
            >
              Cadeau {choix + 1} / {liste.length}
              <span className="block truncate text-[10px] tracking-normal text-cendre/55 normal-case">
                {tirageAffiche?.cadeau_nom ?? "Bon de réduction"}
              </span>
            </button>
            <button
              type="button"
              aria-label="Cadeau suivant"
              onClick={() => {
                setChoix((c) => (c + 1) % liste.length);
                setRelance((n) => n + 1);
              }}
              className="grid size-8 place-items-center rounded-md text-cendre/70 hover:bg-white/5 hover:text-creme"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}

        {!peutTourner && !resultat && (
          <Link
            href="/resultat"
            className="btn-fantome mt-2 w-full !py-2 text-[12px]"
          >
            Voir tous mes cadeaux
          </Link>
        )}
      </div>

      {/* Résultat en popup — jamais de redirection automatique */}
      {peutVoirResultat && (
        <PopupResultat
          tirage={tirageAffiche}
          qrDataUrl={qrAffiche}
          messagePerdu={messagePerdu}
          boutique={boutique}
          ouvert={popup}
          onFermer={() => setPopup(false)}
          navigation={
            liste.length > 1
              ? {
                  position: choix + 1,
                  total: liste.length,
                  precedent: () => {
                    setChoix((c) => (c + 1) % liste.length);
                    setRelance((n) => n + 1);
                  },
                  suivant: () => {
                    setChoix((c) => (c + 1) % liste.length);
                    setRelance((n) => n + 1);
                  },
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

/**
 * Index de la case correspondant à un tirage déjà joué.
 *
 * Le serveur ne stocke que l'identifiant du cadeau : on retrouve sa case dans
 * la roue courante. Pour un tirage perdant (ou un lot depuis retiré de la
 * roue), on retombe sur la première case « Perdu » connue.
 */
function caseIndexDeTirages(tirage: TirageResultat | undefined, cases: CadeauRoue[]): number {
  if (!tirage) return 0;
  if (tirage.statut === "gagne") {
    const parNom = cases.findIndex((c) => c.nom === tirage.cadeau_nom);
    if (parNom >= 0) return parNom;
  }
  const perdue = cases.findIndex((c) => c.id < 0);
  return perdue >= 0 ? perdue : 0;
}
