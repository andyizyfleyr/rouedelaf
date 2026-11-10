import type { ReactNode } from "react";

import { boutique } from "@/lib/env";
import { CadreJeu } from "@/components/client/BarreJeu";

/**
 * Gabarit des pages client. Le fond « velours » est fourni par le layout
 * racine ; la largeur du cadre dépend de la page (voir `CadreJeu`) : colonne
 * de téléphone pour l'inscription, pleine largeur pour la roue à deux
 * colonnes, qui a besoin de place pour être grande.
 */
export default function LayoutClient({ children }: { children: ReactNode }) {
  return (
    <CadreJeu nom={boutique.nom} pied={`${boutique.adresse} · Un cadeau par personne`}>
      {children}
    </CadreJeu>
  );
}
