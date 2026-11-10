"use client";

import { motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import {
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
import { deverrouillerAudio } from "@/lib/sons";
import type {
  CadeauRoue,
  ResultatTirageApi,
  TirageResultat,
} from "@/lib/types";

/**
 * /roue — DEUX COLONNES : la roue à droite, les textes et le bouton à gauche.
 *
 * La roue se dimensionne sur la HAUTEUR DE L'ÉCRAN (`100dvh`), pas sur une
 * largeur fixe : c'est ce qui la rend vraiment grande sur ordinateur et
 * tablette, où elle occupait avant un petit carré au milieu du vide.
 *
 * Adaptation :
 *  - `sm` et plus (ordinateur, tablette, téléphone en paysage) : deux
 *    colonnes, textes à gauche, roue géante à droite ;
 *  - téléphone en portrait : une seule colonne. Deux colonnes sur 390 px
 *    écraseraient la roue à ~220 px et rendraient les libellés illisibles ;
 *    la roue prend donc toute la largeur, ce qui est la plus grande taille
 *    possible dans ce format. Les textes restent compacts au-dessus.
 *
 * Le résultat est décidé AVANT l'animation (le serveur renvoie `caseIndex`) :
 * le doigt s'arrête exactement dessus, impossible de tricher côté navigateur.
 *
 * ⚠️ Aucune redirection automatique : dès que la roue s'immobilise, la popup
 * de résultat s'ouvre par-dessus. On reste sur /roue, on peut fermer la popup
 * pour revoir la roue ou rouvrir son cadeau.
 */
export function EcranRoue({
  cases,
  nom,
  toursRestants,
  tirageInitial,
  qrInitial,
  messagePerdu,
  boutique,
}: {
  cases: CadeauRoue[];
  nom: string;
  toursRestants: number;
  /** Résultat déjà obtenu (le joueur n'a plus de tour) : popup proposée. */
  tirageInitial: TirageResultat | null;
  qrInitial: string | null;
  messagePerdu: string;
  boutique: { nom: string; adresse: string; whatsapp: string };
}) {
  const [chargement, setChargement] = useState(false);
  const [cible, setCible] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatTirageApi | null>(null);
  /** La roue est immobile : la popup de résultat peut s'ouvrir. */
  const [arretee, setArretee] = useState(false);
  const [popup, setPopup] = useState(false);
  const dejaLance = useRef(false);

  const tourner = useCallback(async () => {
    if (chargement || cible !== null || dejaLance.current) return;
    dejaLance.current = true;
    setErreur(null);
    setChargement(true);
    deverrouillerAudio();

    try {
      const res = await fetch("/api/tirage", {
        method: "POST",
        headers: entetesJeu(),
      });
      const data = await res.json();

      if (!res.ok) {
        setErreur(data.erreur ?? "Le tirage n'a pas pu démarrer.");
        setChargement(false);
        dejaLance.current = false;
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
      dejaLance.current = false;
    }
  }, [chargement, cible]);

  /**
   * La roue vient de s'immobiliser : on ouvre la popup de résultat TOUT DE
   * SUITE. Le tour est terminé, le cadeau doit s'afficher — sans pour autant
   * quitter la page (aucune redirection).
   */
  const surFin = useCallback(() => {
    setArretee(true);
    setPopup(true);
  }, []);

  /**
   * Ce que la popup affiche : le tirage qui vient d'être joué, ou celui que le
   * joueur avait déjà (il n'a plus de tour). Les deux ont la forme
   * `TirageResultat`, reconstruite à partir de la réponse API si besoin.
   */
  const tirageAffiche: TirageResultat | null = resultat
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
    : tirageInitial;

  const peutVoirResultat = tirageAffiche !== null;
  /** QR : celui renvoyé par /api/tirage, sinon celui préparé au chargement. */
  const qrAffiche = resultat?.qrDataUrl ?? qrInitial;
  const enVol = cible !== null && !arretee;

  const titreBouton = chargement
    ? "Préparation…"
    : enVol
      ? "La roue tourne…"
      : resultat
        ? "Voir mon cadeau"
        : tirageAffiche
          ? "Revoir mon cadeau"
          : "Tourner la roue";

  return (
    /**
     * Le cadre de /roue est en pleine largeur, sans marge intérieure : la roue
     * touche donc les bords de l'écran sur téléphone.
     *
     * MOBILE (< sm) : une colonne, dans cet ordre — textes, roue, bouton.
     * SM ET PLUS : une GRILLE à deux colonnes et deux rangées.
     *   ┌───────────────┬──────────────────┐
     *   │ textes        │                  │
     *   ├───────────────┤   roue (1→3)     │
     *   │ bouton        │                  │
     *   └───────────────┴──────────────────┘
     * Pourquoi une grille et non deux flex imbriqués : le bouton doit être le
     * DERNIER élément dans le DOM (il passe sous la roue sur mobile) tout en
     * remontant sous les textes à gauche sur grand écran. La grille le place
     * explicitement avec `col-start` / `row-start`, sans dépendre de l'ordre
     * du DOM ni d'un `display: contents` fragile.
     */
    <div className="grid min-h-0 w-full flex-1 grid-cols-1 content-center justify-items-center gap-3 px-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:grid-rows-[auto_1fr] sm:content-center sm:items-center sm:justify-items-start sm:gap-x-14 sm:gap-y-4 sm:px-12 sm:py-6">
      {/* ————— TEXTES (colonne 1, rangée 1) ————— */}
      <div className="flex w-full min-w-0 flex-col items-center gap-2 px-4 pt-2 text-center sm:col-start-1 sm:row-start-1 sm:max-w-[30rem] sm:items-start sm:gap-3 sm:px-0 sm:pt-0 sm:text-left">
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-or/30 bg-or/[0.07] px-2.5 py-0.5 text-[9px] leading-tight font-semibold tracking-[0.16em] text-or-clair/85 uppercase sm:px-3 sm:py-1 sm:text-[10.5px]">
          <Sparkles className="size-2.5 shrink-0 sm:size-3" />
          <span className="truncate">
            {toursRestants > 1 ? `${toursRestants} tours` : "1 tour offert"} ·
            cadeau garanti
          </span>
        </span>

        <h1 className="texte-or font-titre text-[19px] leading-[1.06] font-bold tracking-[0.02em] uppercase sm:text-[clamp(24px,2.4vw,34px)]">
          {nom},
          <br />
          <span className="text-[15px] tracking-[0.06em] sm:text-[clamp(18px,1.7vw,25px)]">
            à vous de jouer
          </span>
        </h1>

        <p className="max-w-[34ch] text-[10.5px] leading-snug text-cendre/70 sm:text-[13px]">
          Tournez la roue et découvrez votre cadeau. Un seul tour par personne.
        </p>

        {erreur && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex w-full max-w-[38ch] items-start gap-1.5 rounded-lg border border-bordeaux-clair/50 bg-bordeaux/40 px-2 py-1.5 text-[10.5px] leading-snug text-rose-100"
          >
            <TriangleAlert className="mt-px size-3 shrink-0" />
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

      {/* ————— LA ROUE (colonne 2, les deux rangées) ————— */}
      <div className="order-2 flex min-h-0 min-w-0 items-center justify-center sm:order-none sm:col-start-2 sm:row-span-2 sm:row-start-1">
        <div className="h-[min(calc(100dvh-11rem),100vw)] w-[min(calc(100dvh-11rem),100vw)] sm:h-[min(calc(100dvh-3rem),56vw)] sm:w-[min(calc(100dvh-3rem),56vw)]">
          <Roue
            cases={cases}
            caseCible={cible}
            onFin={surFin}
            tours={6}
            duree={6.6}
            taille={420}
            pleinEcran
          />
        </div>
      </div>

      {/* ————— LE BOUTON (colonne 1, rangée 2 ; sous la roue sur mobile) ————— */}
      <div className="order-3 w-full shrink-0 px-4 sm:order-none sm:col-start-1 sm:row-start-2 sm:self-start sm:px-0">
        <button
          type="button"
          onClick={() =>
            peutVoirResultat && (arretee || !resultat)
              ? setPopup(true)
              : tourner()
          }
          disabled={chargement || enVol}
          className="btn-or w-full !px-3 !py-3 text-[14px] sm:!py-3.5 sm:text-[15px]"
        >
          {chargement || enVol ? (
            <>
              <Loader2 className="size-4 shrink-0 animate-spin" />
              <span className="truncate">{titreBouton}</span>
            </>
          ) : (
            <>
              <Gift className="size-4 shrink-0" />
              <span className="truncate">{titreBouton}</span>
            </>
          )}
        </button>
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
        />
      )}
    </div>
  );
}
