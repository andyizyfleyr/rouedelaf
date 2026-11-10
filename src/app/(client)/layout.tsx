import { Suspense, type ReactNode } from "react";

import { lireIdentite } from "@/lib/identite";
import { CadreJeu } from "@/components/client/BarreJeu";
import { TitreBoutique } from "@/components/client/TitreBoutique";

/**
 * Gabarit des pages client. Le fond « velours » est fourni par le layout
 * racine ; la largeur du cadre dépend de la page (voir `CadreJeu`) : colonne
 * de téléphone pour l'inscription, pleine largeur pour la roue à deux
 * colonnes, qui a besoin de place pour être grande.
 */
export default function LayoutClient({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <CadreJeu nom={process.env.NEXT_PUBLIC_BOUTIQUE_NOM || "Ma Boutique"} pied="">
          {children}
        </CadreJeu>
      }
    >
      <Identite>{children}</Identite>
    </Suspense>
  );
}

/**
 * Lit le nom de la boutique EN BASE (réglable dans l'admin).
 *
 * Cette lecture est dynamique : elle est donc isolée derrière un `<Suspense>`,
 * sinon Next refuse de prérendre la page (erreur « uncached data during
 * prerendering »). Le repli affiche la coquille avec le nom de secours, que
 * la vraie valeur remplace dès que la base a répondu.
 */
async function Identite({ children }: { children: ReactNode }) {
  const identite = await lireIdentite();
  return (
    <CadreJeu nom={identite.nom} pied={`${identite.adresse} · Un cadeau par personne`}>
      <TitreBoutique nom={identite.nom} />
      {children}
    </CadreJeu>
  );
}
