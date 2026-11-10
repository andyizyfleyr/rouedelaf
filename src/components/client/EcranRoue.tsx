"use client";

import { motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { Gift, Loader2, Sparkles, TriangleAlert } from "lucide-react";

import { PopupResultat } from "@/components/client/PopupResultat";
import { Roue } from "@/components/roue/Roue";
import { entetesJeu } from "@/lib/appareil";
import { suivreEvenement } from "@/lib/pixel";
import { deverrouillerAudio } from "@/lib/sons";
import type { CadeauRoue, ResultatTirageApi, TirageResultat } from "@/lib/types";

/**
 * /roue — LA ROUE OCCUPE TOUT L'ÉCRAN.
 *
 * Mise en page : la roue est dimensionnée sur `min(100vw, 100dvh)` et centrée,
 * donc elle prend toute la place disponible, en portrait comme en paysage,
 * sans jamais déborder. Le titre et le bouton se superposent au-dessus et
 * en dessous : ils ne volent pas de hauteur à la roue.
 *
 * Le résultat est décidé AVANT l'animation (le serveur renvoie `caseIndex`) :
 * le doigt s'arrête exactement dessus, impossible de tricher côté navigateur.
 *
 * ⚠️ Aucune redirection automatique. Quand la roue s'arrête, un bouton
 * « Voir mon cadeau » apparaît ; c'est le joueur qui ouvre la popup de
 * résultat. Une redirection surprise donnait l'impression que la page se
 * fermait toute seule.
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
  /** La roue est immobile : le bouton « Voir mon cadeau » peut apparaître. */
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
      const res = await fetch("/api/tirage", { method: "POST", headers: entetesJeu() });
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

  const surFin = useCallback(() => setArretee(true), []);

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
  const titreBouton = resultat
    ? "Voir mon cadeau"
    : tirageAffiche
      ? "Revoir mon résultat"
      : "Tourner la roue";

  return (
    /**
     * Tout est en FLUX et centré verticalement : titre, roue, bouton.
     *
     * La roue se dimensionne sur l'ÉCRAN (100vw), pas sur son parent, donc les
     * marges du gabarit ne la rétrécissent plus : elle touche les bords. Le
     * `- 132px` de sa hauteur maximale est exactement la place du titre et du
     * bouton, ce qui évite de laisser un grand vide ou de couper le bouton.
     */
    <div className="-mx-3.5 flex min-h-0 w-[calc(100%+1.75rem)] flex-1 flex-col items-center justify-center gap-2.5">
      {/* Le haut de l'écran est rempli par le badge + le compteur de tours :
          la roue reste plein cadre sans laisser de mur vide au-dessus. */}
      <header className="flex w-full shrink-0 flex-col items-center gap-1">
        <span className="flex items-center gap-1.5 rounded-full border border-or/30 bg-or/[0.07] px-2.5 py-0.5 text-[9px] font-semibold tracking-[0.18em] text-or-clair/85 uppercase">
          <Sparkles className="size-2.5" />
          {toursRestants > 1 ? `${toursRestants} tours` : "1 tour offert"}
          <span className="text-cendre/45">·</span> cadeau garanti
        </span>
        <h1 className="texte-or px-3 font-titre text-[15px] leading-tight font-bold tracking-[0.05em] uppercase sm:text-[17px]">
          {nom}, à vous de jouer
        </h1>
      </header>

      <div className="apparait flex min-h-0 w-full shrink-0 items-center justify-center">
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

      <div className="w-full shrink-0 px-3.5">
        {erreur && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-1.5 flex items-start gap-2 rounded-xl border border-bordeaux-clair/50 bg-bordeaux/40 px-2.5 py-1.5 text-[11.5px] leading-snug text-rose-100"
          >
            <TriangleAlert className="mt-px size-3.5 shrink-0" />
            <span>{erreur}</span>
          </motion.p>
        )}

        <button
          type="button"
          onClick={() => (peutVoirResultat && (arretee || !resultat) ? setPopup(true) : tourner())}
          disabled={chargement || (cible !== null && !arretee)}
          className="btn-or w-full !py-3 text-[15px]"
        >
          {chargement ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Préparation…
            </>
          ) : cible !== null && !arretee ? (
            <>
              <Loader2 className="size-4 animate-spin" /> La roue tourne…
            </>
          ) : (
            <>
              <Gift className="size-4" /> {titreBouton}
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
