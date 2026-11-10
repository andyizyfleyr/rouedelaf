import { Suspense } from "react";

import { EcranRoue } from "@/components/client/EcranRoue";
import { construireCases } from "@/lib/roue";
import { chargerCadeauxRoue } from "@/server/tirage";
import { lireParametres } from "@/server/params";

export const metadata = {
  title: "La roue",
  description: "Tournez la roue de Noël et découvrez votre cadeau.",
};

/**
 * /roue — la roue, rien d'autre.
 *
 * Le jeu tourne sur le POSTE DE LA BOUTIQUE : pas d'inscription, pas de
 * session, pas de nom. Le client arrive sur la roue, appuie sur le moyeu, voit
 * son cadeau, ferme la popup — et le client suivant peut jouer immédiatement.
 *
 * La page est donc volontairement SANS état côté serveur : elle ne charge que
 * les cases de la roue et les réglages. Tout le reste (le tirage) passe par
 * POST /api/tirage, qui ne dépend d'aucun cookie.
 */
export default function PageRoue() {
  return (
    <Suspense fallback={<SqueletteRoue />}>
      <Contenu />
    </Suspense>
  );
}

/** Coquille statique : la roue occupe l'écran tout de suite (même en 3G). */
function SqueletteRoue() {
  return (
    <div className="flex w-full flex-1 items-center justify-center">
      <div className="aspect-square w-full max-w-[min(100vw,100dvh)] animate-pulse rounded-full border border-or/15 bg-gradient-to-br from-white/5 to-transparent" />
    </div>
  );
}

async function Contenu() {
  const parametres = await lireParametres();
  const cadeaux = await chargerCadeauxRoue();
  const cases = construireCases(
    cadeaux.map((c) => ({
      id: Number(c.id),
      nom: c.nom,
      couleur: c.couleur,
      icone: c.icone,
      probabilite: Number(c.probabilite),
      stock: Number(c.stock),
      // Une case avec photo n'affichera QUE la photo (voir components/roue/Roue).
      image_url: c.image_url,
    })),
  );

  return (
    /* L'écran n'affiche QUE la roue : ni nom, ni compteur de tours, ni adresse
       de boutique, ni bouton. Le lancement passe par le moyeu « ROUE ». */
    <EcranRoue
      cases={cases}
      jeuOuvert={parametres.activeJeu}
      lotsDisponibles={cadeaux.some((c) => Number(c.stock) > 0 && Number(c.probabilite) > 0)}
    />
  );
}
