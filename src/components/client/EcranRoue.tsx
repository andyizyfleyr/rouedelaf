"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";

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
  toursRestants,
  tiragesInitiaux,
  qrInitial,
  messagePerdu,
  jeuOuvert,
  lotsDisponibles,
  boutique,
}: {
  cases: CadeauRoue[];
  toursRestants: number;
  /** Tous les tirages déjà joués (du plus récent au plus ancien). */
  tiragesInitiaux: TirageResultat[];
  /** QR du dernier tirage gagné, préparé côté serveur. */
  qrInitial: string | null;
  messagePerdu: string;
  /** Le jeu est-il ouvert (réglage admin) ? */
  jeuOuvert: boolean;
  /** Reste-t-il au moins un lot en stock ? */
  lotsDisponibles: boolean;
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
  const peutTourner = toursRestants > 0 && !resultat && !jeuIndisponible;
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
    /*
      ÉCRAN 100 % ROUE.

      Tout ce qui n'était pas la roue a été retiré (badge « N tours · cadeau
      garanti », nom du joueur, phrase d'accueil, adresse de la boutique,
      bouton « Tourner la roue », sélecteur « Cadeau 2 / 7 », lien « Voir tous
      mes cadeaux »). Le joueur lance la partie en appuyant sur la boule
      « ROUE », au centre — la seule chose actionnable de l'écran.

      La roue est centrée dans les deux axes, et dimensionnée sur la PLUS
      PETITE des deux contraintes (largeur / hauteur) : elle est donc toujours
      entièrement visible, jamais coupée, et la plus grande possible.
    */
    /*
      `absolute inset-0` : la roue se centre sur la TOTALITÉ de l'écran, pas
      sur la hauteur restante du conteneur. Sans cela, un `main` en colonne
      (voir CadreJeu) la laissait collée en haut sur téléphone.
    */
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="h-[min(100vw,calc(100dvh-0.5rem))] w-[min(100vw,calc(100dvh-0.5rem))] max-h-full max-w-full">
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
          onLancer={actionBouton}
          cliquable={peutTourner || (resultat !== null && (arretee || !enVol))}
          clignote={peutTourner || (resultat !== null && (arretee || !enVol))}
          indisponible={jeuIndisponible && !resultat}
        />
      </div>

      {/*
        Messages d'erreur : les seuls textes conservés, parce qu'ils disent
        pourquoi le moyeu ne répond pas (réseau coupé, tour déjà consommé,
        plus de stock). Ils flottent AU-DESSUS de la roue, sans la décaler,
        et disparaissent d'eux-mêmes à la tentative suivante.
      */}
      {erreur && (
        <motion.p
          ref={refErreur}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="pointer-events-none absolute inset-x-3 bottom-4 z-20 mx-auto flex max-w-[38ch] items-start gap-2 rounded-xl border border-rose-300/50 bg-rose-950/90 px-3 py-2.5 text-[13px] leading-snug font-semibold text-rose-50 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.85)]"
        >
          <TriangleAlert className="mt-px size-5 shrink-0" aria-hidden />
          <span>{erreur}</span>
        </motion.p>
      )}

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
