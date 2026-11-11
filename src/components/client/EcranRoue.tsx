"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";

import { PopupResultat } from "@/components/client/PopupResultat";
import { Roue } from "@/components/roue/Roue";
import { entetesJeu } from "@/lib/appareil";
import { suivreEvenement } from "@/lib/pixel";
import { demarrerAmbiance, deverrouillerAudio } from "@/lib/sons";
import type { CadeauRoue, ResultatTirageApi } from "@/lib/types";

/**
 * /roue — LA ROUE SEULE.
 *
 * Le jeu tourne sur le poste de la boutique, l'un après l'autre : le client
 * appuie sur le moyeu, la roue s'arrête, la popup « Félicitations » montre le
 * cadeau. Il la ferme → la roue est immédiatement rejouable, prête pour le
 * client suivant. Aucune session, aucune mémoire d'un tour précédent : un
 * rechargement de page ne ressuscite jamais la partie d'avant.
 *
 * Le résultat est décidé AVANT l'animation (le serveur renvoie `caseIndex`) :
 * le doigt s'arrête exactement dessus, impossible de tricher côté navigateur.
 *
 * ⚠️ Aucune redirection automatique : dès que la roue s'immobilise, la popup
 * de résultat s'ouvre par-dessus. On reste sur /roue.
 */
export function EcranRoue({
  cases,
  jeuOuvert,
  lotsDisponibles,
}: {
  cases: CadeauRoue[];
  /** Le jeu est-il ouvert (réglage admin) ? */
  jeuOuvert: boolean;
  /** Reste-t-il au moins un lot en stock ? */
  lotsDisponibles: boolean;
}) {
  const [chargement, setChargement] = useState(false);
  const [cible, setCible] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  /** Ancre du message d'erreur : sur mobile il est au-dessus de la roue. */
  const refErreur = useRef<HTMLParagraphElement | null>(null);
  /** Résultat du tour en cours : la popup l'affiche, puis il est oublié. */
  const [resultat, setResultat] = useState<ResultatTirageApi | null>(null);
  /** La roue est immobile : la popup de résultat peut s'ouvrir. */
  const [arretee, setArretee] = useState(false);
  const [popup, setPopup] = useState(false);

  const enVol = cible !== null && !arretee;

  const tourner = useCallback(async () => {
    if (chargement || enVol) return;
    setErreur(null);
    setChargement(true);
    deverrouillerAudio();
    // Au cas où le premier geste aurait été avalé par un navigateur récalcitrant :
    // le clic sur le moyeu est une interaction sûre, on relance l'ambiance.
    demarrerAmbiance();

    try {
      const res = await fetch("/api/tirage", { method: "POST", headers: entetesJeu() });
      const data = await res.json();

      if (!res.ok) {
        setErreur(data.erreur ?? "Le tirage n'a pas pu démarrer.");
        setChargement(false);
        return;
      }

      const resultatApi = data as ResultatTirageApi;
      setResultat(resultatApi);
      setCible(resultatApi.caseIndex);
      setChargement(false);
      suivreEvenement("joue_debut", { etape: "tirage" });
    } catch {
      setErreur("Connexion instable. Vérifiez votre réseau et réessayez.");
      setChargement(false);
    }
  }, [chargement, enVol]);

  /**
   * Entretien silencieux : détoure les photos produits encore sur fond blanc.
   *
   * Les photos enregistrées avant l'arrivée du détourage automatique gardent
   * leur fond d'origine ; dans une case, ce rectangle est découpé en biseau
   * par le secteur — c'est le rendu « pas joli ». On les traite donc ici, en
   * tâche de fond, dès que la roue s'affiche.
   *
   * Pourquoi côté navigateur et pas dans la page (rendu serveur) : la page
   * roue est prérendue, donc servie depuis le cache — son code ne s'exécute
   * pas à chaque visite. Un appel depuis le client est déterministe.
   *
   * Volontairement discret : aucun état, aucun message, aucune erreur à
   * l'écran. Une fois le catalogue à jour, l'appel ne fait plus rien.
   */
  useEffect(() => {
    const controleur = new AbortController();
    const minuteur = setTimeout(() => {
      fetch("/api/detourage", { method: "POST", signal: controleur.signal }).catch(() => {
        // Hors ligne, onglet fermé : on retentera à la prochaine visite.
      });
    }, 1500); // après le premier rendu : la roue passe avant tout
    return () => {
      clearTimeout(minuteur);
      controleur.abort();
    };
  }, []);

  /** F3 — un message d'erreur doit être VU (il est au-dessus de la roue). */
  useEffect(() => {
    if (!erreur) return;
    refErreur.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [erreur]);

  /**
   * La roue vient de s'immobiliser : on ouvre la popup de résultat TOUT DE
   * SUITE. Le client regarde son cadeau, ferme la popup, et la roue est
   * aussitôt rejouable pour le client suivant.
   */
  const surFin = useCallback(() => {
    setArretee(true);
    setPopup(true);
  }, []);

  /**
   * PRÉPARER LE TOUR SUIVANT — appelé à la fermeture de la popup.
   *
   * C'est le cœur du modèle « poste en boutique » : après un tour, il ne doit
   * RIEN rester de la partie précédente. On remet donc la roue à son angle de
   * repos et on oublie le tirage ; un appui sur le moyeu relance un tirage
   * entièrement neuf, quel que soit le client devant l'écran.
   */
  const oublierLeTour = useCallback(() => {
    setPopup(false);
    setResultat(null);
    setCible(null);
    setArretee(false);
  }, []);

  /**
   * Peut-on lancer un tirage ? Le jeu doit être ouvert et il doit rester au
   * moins un lot. Le moyeu l'annonce lui-même (« RECHARGE ») avant le clic :
   * le client ne consomme pas un tour pour découvrir que la roue est vide.
   */
  const jeuIndisponible = !jeuOuvert || !lotsDisponibles;
  const peutTourner = !jeuIndisponible && !enVol;

  return (
    /*
      ÉCRAN 100 % ROUE.

      Tout ce qui n'était pas la roue a été retiré (badge de tours, nom du
      joueur, phrase d'accueil, adresse de la boutique, bouton « Tourner la
      roue », sélecteurs, liens). Le joueur lance la partie en appuyant sur la
      boule « ROUE », au centre — la seule chose actionnable de l'écran.

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
          cases={cases}
          caseCible={cible}
          onFin={surFin}
          tours={6}
          duree={6.6}
          taille={420}
          pleinEcran
          onLancer={() => void tourner()}
          cliquable={peutTourner}
          clignote={peutTourner}
          indisponible={jeuIndisponible}
        />
      </div>

      {/*
        Messages d'erreur : les seuls textes conservés, parce qu'ils disent
        pourquoi le moyeu ne répond pas (réseau coupé, plus de stock). Ils
        flottent AU-DESSUS de la roue, sans la décaler, et disparaissent
        d'eux-mêmes à la tentative suivante.
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

      {/* Résultat en popup — fermer la popup rend la roue rejouable aussitôt */}
      {resultat && (
        <PopupResultat
          resultat={resultat}
          ouvert={popup}
          onFermer={oublierLeTour}
        />
      )}
    </div>
  );
}
