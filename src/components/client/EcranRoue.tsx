"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Gift, Loader2, Sparkles, TriangleAlert } from "lucide-react";

import { Roue } from "@/components/roue/Roue";
import { BoutonOr, Carte, Pastille, TitreOr } from "@/components/ui/Base";
import { entetesJeu } from "@/lib/appareil";
import { suivreEvenement } from "@/lib/pixel";
import { deverrouillerAudio } from "@/lib/sons";
import type { CadeauRoue, ResultatTirageApi } from "@/lib/types";

/**
 * Écran /roue : bouton « Tourner » → appel serveur → animation → redirection.
 *
 * Le résultat est DECIDÉ AVANT l'animation : on reçoit `caseIndex` et la roue
 * s'arrête précisément dessus. Impossible de « tricher » côté navigateur.
 */
export function EcranRoue({
  cases,
  nom,
  toursRestants,
  codeParrain,
}: {
  cases: CadeauRoue[];
  nom: string;
  toursRestants: number;
  codeParrain: string | null;
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

  /** Appelé par la roue quand l'aiguille s'est arrêtée. */
  const surFin = useCallback(() => {
    if (!resultat) return;
    // Petit temps de suspense avant la page résultat.
    setTimeout(() => {
      router.push(`/resultat?t=${resultat.tirageId}`);
    }, 900);
  }, [resultat, router]);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <header className="text-center">
        <Pastille ton="or" className="mb-3">
          <Sparkles className="size-3.5" />
          {toursRestants > 1 ? `${toursRestants} tours disponibles` : "1 tour à jouer"}
        </Pastille>
        <TitreOr as="h1" className="text-[1.7rem] sm:text-[2rem]">
          {nom}, à vous de jouer
        </TitreOr>
        <p className="mt-2 text-[13px] leading-relaxed text-cendre">
          Appuyez sur le bouton : la roue tourne et votre cadeau est déjà choisi.
        </p>
      </header>

      <Roue
        cases={cases}
        caseCible={cible}
        onFin={surFin}
        tours={8}
        duree={6.4}
        taille={430}
      />

      <div className="mt-3 flex flex-col gap-3">
        <AnimatePresence mode="wait">
          {erreur ? (
            <motion.div
              key="erreur"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 rounded-xl border border-bordeaux-clair/50 bg-bordeaux/25 px-3 py-2.5 text-[12.5px] leading-relaxed text-rose-100"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{erreur}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <BoutonOr
          type="button"
          onClick={tourner}
          disabled={chargement || cible !== null}
          className="py-4 text-lg"
        >
          {chargement ? (
            <>
              <Loader2 className="size-5 animate-spin" /> Préparation…
            </>
          ) : cible !== null ? (
            <>
              <Sparkles className="size-5 animate-pulse" /> La roue tourne…
            </>
          ) : (
            <>
              <Gift className="size-5" /> Tourner la roue
            </>
          )}
        </BoutonOr>

        <Carte className="!p-4">
          <p className="text-center text-[11.5px] leading-relaxed text-cendre/75">
            Votre cadeau est décidé par le serveur de la boutique. Un code unique vous est remis
            pour le retirer en magasin.
          </p>
        </Carte>
      </div>

      {codeParrain && (
        <p className="text-center text-[11px] text-cendre/50">
          Votre code ami : <span className="font-mono text-or/80">{codeParrain}</span>
        </p>
      )}
    </div>
  );
}
