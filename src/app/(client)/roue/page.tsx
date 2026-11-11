import { Suspense } from "react";
import { after } from "next/server";

import { EcranRoue } from "@/components/client/EcranRoue";
import { construireCases } from "@/lib/roue";
import { chargerCadeauxRoue } from "@/server/tirage";
import { detourerImagesExistantes } from "@/server/images";
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
  /*
   * Rattrapage du détourage, APRÈS l'envoi de la page.
   *
   * Les photos enregistrées avant l'arrivée du détourage automatique gardent
   * leur fond blanc : dans une case, elles forment un rectangle penché que le
   * secteur découpe en biseau. On les traite donc ici, en tâche de fond, pour
   * que la roue se répare d'elle-même même si personne n'ouvre l'admin.
   *
   * `after()` et non une promesse lancée sans l'attendre : sur Vercel, une
   * fonction serverless est gelée dès que la réponse est partie, et une
   * promesse orpheline serait tuée avant d'avoir fini. `after` garantit que
   * ce travail s'exécute APRÈS la réponse — la page, elle, n'attend rien.
   */
  after(async () => {
    await detourerImagesExistantes(4);
  });

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
    parametres.nombreCases,
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
