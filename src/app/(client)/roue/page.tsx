import { Suspense } from "react";
import { redirect } from "next/navigation";

import { EcranRoue } from "@/components/client/EcranRoue";
import { construireCases } from "@/lib/roue";
import { lireSessionJeu } from "@/lib/session";
import { chargerCadeauxRoue, toursRestants } from "@/server/tirage";
import { listeTiragesParticipant } from "@/server/data";
import { lireParametres } from "@/server/params";
import { boutique } from "@/lib/env";
import QRCode from "qrcode";

export const metadata = {
  title: "La roue",
  description: "Tournez la roue de Noël et découvrez votre cadeau.",
};

/**
 * /roue — la roue tourne, le résultat vient du serveur.
 *
 * La page est un composant serveur :
 *  - elle vérifie la session de jeu ;
 *  - elle charge les lots et calcule la roue (même fonction que le serveur
 *    de tirage, pour que l'index annoncé corresponde exactement) ;
 *  - elle transmet la liste des cases au composant client.
 *
 * Le tirage lui-même est déclenché par POST /api/tirage.
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
  const session = await lireSessionJeu();
  if (!session) redirect("/jouer");

  const restants = await toursRestants(session.participantId);

  const parametres = await lireParametres();

  // Tous les tirages du joueur (pas seulement le dernier) : dès qu'un second
  // cadeau est gagné (parrainage, tours offerts), le premier doit rester
  // consultable. Avant, seul le dernier était affiché et l'autre bon devenait
  // invisible alors qu'il restait valide en boutique.
  const tiragesInitiaux = await listeTiragesParticipant(session.participantId);
  const messagePerdu = parametres.messagePerdu;

  // QR du dernier gain, généré côté serveur : il s'affiche même si le client
  // n'a pas de connexion stable au moment d'ouvrir la popup.
  let qrInitial: string | null = null;
  const dernierGagne = tiragesInitiaux.find((t) => t.statut === "gagne" && t.code_unique);
  if (dernierGagne?.code_unique) {
    qrInitial = await QRCode.toDataURL(dernierGagne.code_unique, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 420,
      color: { dark: "#0a0908", light: "#f8e7a8" },
    });
  }

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
      toursRestants={restants}
      jeuOuvert={parametres.activeJeu}
      lotsDisponibles={cadeaux.some((c) => Number(c.stock) > 0 && Number(c.probabilite) > 0)}
      tiragesInitiaux={tiragesInitiaux}
      qrInitial={qrInitial}
      messagePerdu={messagePerdu}
      boutique={{ nom: boutique.nom, adresse: boutique.adresse, whatsapp: boutique.whatsapp }}
    />
  );
}
