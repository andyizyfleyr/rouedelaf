import { Suspense } from "react";

import { GestionCadeaux } from "@/components/admin/GestionCadeaux";
import { TitreOr } from "@/components/ui/Base";
import { listerCadeauxAdmin } from "@/server/data";
import { listerImages } from "@/server/images";

export const metadata = { title: "Cadeaux" };

/** /admin/cadeaux — ajout, modification, stock, probabilités, couleurs. */
export default function PageCadeaux() {
  return (
    <div className="py-5">
      <header className="mb-5">
        <p className="text-[11px] tracking-[0.2em] text-or/70 uppercase">Catalogue</p>
        <TitreOr as="h1" className="mt-1 text-2xl sm:text-3xl">
          Cadeaux
        </TitreOr>
        <p className="mt-2 max-w-[70ch] text-[12.5px] leading-relaxed text-cendre/75">
          La probabilité est un <strong className="text-creme">poids relatif</strong> : les lots
          indisponibles (stock à 0 ou désactivés) sont retirés du calcul et les poids restants sont
          renormalisés. Une somme de 60 % laisse donc 40 % de chances de perdre.
        </p>
      </header>

      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/5" />}>
        <Contenu />
      </Suspense>
    </div>
  );
}

async function Contenu() {
  const [cadeaux, galerie] = await Promise.all([listerCadeauxAdmin(), listerImages()]);
  return <GestionCadeaux cadeaux={cadeaux} galerie={galerie} />;
}
