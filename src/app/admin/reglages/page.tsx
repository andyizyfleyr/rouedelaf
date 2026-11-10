import { Suspense } from "react";

import { FormulaireReglages } from "@/components/admin/FormulaireReglages";
import { TitreOr } from "@/components/ui/Base";
import { lireParametres } from "@/server/params";
import { listerJournal } from "@/server/audit";

export const metadata = { title: "Réglages" };

/** /admin/reglages — paramètres du jeu + journal d'audit. */
export default function PageReglages() {
  return (
    <div className="py-5">
      <header className="mb-4">
        <p className="text-[11px] tracking-[0.2em] text-or/70 uppercase">Configuration</p>
        <TitreOr as="h1" className="mt-1 text-2xl sm:text-3xl">
          Réglages du jeu
        </TitreOr>
      </header>

      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/5" />}>
        <Contenu />
      </Suspense>
    </div>
  );
}

async function Contenu() {
  const [parametres, journal] = await Promise.all([lireParametres(), listerJournal(25)]);
  return <FormulaireReglages parametres={parametres} journal={journal} />;
}
