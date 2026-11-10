"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Gift, Loader2, RotateCcw, TriangleAlert } from "lucide-react";

import { Roue } from "@/components/roue/Roue";
import { BoutonOr } from "@/components/ui/Base";
import { entetesJeu } from "@/lib/appareil";
import { suivreEvenement } from "@/lib/pixel";
import { deverrouillerAudio } from "@/lib/sons";
import type { CadeauRoue, ResultatTirageApi } from "@/lib/types";

/**
 * /roue — la roue occupe l'écran, tout le reste est réduit au strict minimum.
 *
 * Principe de mise en page : sur un téléphone, l'ensemble (en-tête + roue +
 * bouton) doit tenir SANS défilement. On ne met donc plus de paragraphes
 * explicatifs : une ligne d'état, la roue, un bouton.
 *
 * Le résultat est décidé AVANT l'animation (le serveur renvoie `caseIndex`) :
 * le doigt s'arrête exactement dessus, impossible de tricher côté navigateur.
 */
export function EcranRoue({
  cases,
  nom,
  toursRestants,
}: {
  cases: CadeauRoue[];
  nom: string;
  toursRestants: number;
}) {
  const router = useRouter();
  const [chargement, setChargement] = useState(false);
  const [cible, setCible] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatTirageApi | null>(null);
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

  /** Appelé quand le doigt s'est immobilisé. */
  const surFin = useCallback(() => {
    if (!resultat) return;
    setTimeout(() => router.push(`/resultat?t=${resultat.tirageId}`), 950);
  }, [resultat, router]);

  const enCours = chargement || cible !== null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      {/* Une seule ligne d'état, pas de paragraphe */}
      <div className="w-full text-center">
        <h1 className="texte-or font-titre text-[16px] leading-tight font-bold tracking-[0.04em] uppercase sm:text-[18px]">
          {nom}, à vous de jouer
        </h1>
        <p className="mt-0.5 text-[10px] tracking-[0.16em] text-cendre/60 uppercase">
          {toursRestants > 1 ? `${toursRestants} tours disponibles` : "1 tour · cadeau garanti"}
        </p>
      </div>

      <div className="apparait w-full">
        <Roue
          cases={cases}
          caseCible={cible}
          onFin={surFin}
          tours={6}
          duree={6.6}
          taille={350}
        />
      </div>

      <div className="mt-3 flex w-full flex-col gap-2">
        <AnimatePresence>
          {erreur ? (
            <motion.p
              key="erreur"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2 rounded-xl border border-bordeaux-clair/50 bg-bordeaux/25 px-3 py-2 text-[12px] leading-snug text-rose-100"
            >
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              <span>{erreur}</span>
            </motion.p>
          ) : null}
        </AnimatePresence>

        <BoutonOr
          type="button"
          onClick={tourner}
          disabled={enCours}
          className="!py-3.5 text-[15px]"
        >
          {chargement ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Préparation…
            </>
          ) : cible !== null ? (
            <>
              <RotateCcw className="size-4 animate-spin" /> La roue tourne…
            </>
          ) : (
            <>
              <Gift className="size-4" /> Tourner la roue
            </>
          )}
        </BoutonOr>
      </div>
    </div>
  );
}
