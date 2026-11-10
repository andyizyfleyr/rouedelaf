import type { ReactNode } from "react";

import { boutique } from "@/lib/env";
import { BarreJeu, PiedJeu } from "@/components/client/BarreJeu";

/**
 * Gabarit des pages client : centré, mobile d'abord, avec un en-tête discret.
 * Le fond « velours » est fourni par le layout racine.
 */
export default function LayoutClient({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-[480px] flex-col px-3.5 pb-2">
      <BarreJeu nom={boutique.nom} />
      <main className="flex min-h-0 flex-1 flex-col justify-center">{children}</main>
      <PiedJeu texte={`${boutique.adresse} · Un cadeau par personne`} />
    </div>
  );
}
