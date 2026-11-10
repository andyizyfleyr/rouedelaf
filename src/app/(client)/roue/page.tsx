import { Suspense } from "react";
import { redirect } from "next/navigation";

import { EcranRoue } from "@/components/client/EcranRoue";
import { sql } from "@/lib/db";
import { construireCases } from "@/lib/roue";
import { lireSessionJeu } from "@/lib/session";
import { chargerCadeauxRoue, toursRestants } from "@/server/tirage";
import { tirageParId } from "@/server/data";
import { lireParametres } from "@/server/params";
import { boutique } from "@/lib/env";
import QRCode from "qrcode";

export const metadata = {
  title: "La roue",
  description: "Tournez la roue et découvrez votre cadeau.",
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

  // Aucun tour disponible : le joueur a déjà son résultat. On le lui prépare
  // et le composant client ouvrira la popup. ⚠️ Aucune redirection ici : une
  // redirection automatique arrachait le joueur de la page sans qu'il l'ait
  // demandé.
  let tirageInitial = null;
  let qrInitial: string | null = null;
  let messagePerdu = "Pas de chance cette fois !";

  if (restants <= 0) {
    const [dernier] = await sql`
      SELECT id FROM tirages WHERE participant_id = ${session.participantId}
      ORDER BY created_at DESC, id DESC LIMIT 1
    `;
    if (dernier) {
      const tirage = await tirageParId(Number(dernier.id));
      if (tirage) {
        tirageInitial = tirage;
        messagePerdu = (await lireParametres()).messagePerdu;
        if (tirage.statut === "gagne" && tirage.code_unique) {
          // Le QR est généré côté serveur : il s'affiche même si le client
          // n'a pas de connexion stable au moment d'ouvrir la popup.
          qrInitial = await QRCode.toDataURL(tirage.code_unique, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 420,
            color: { dark: "#0a0908", light: "#f8e7a8" },
          });
        }
      }
    }
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
    })),
  );

  return (
    <EcranRoue
      cases={cases}
      nom={session.nom}
      toursRestants={restants}
      tirageInitial={tirageInitial}
      qrInitial={qrInitial}
      messagePerdu={messagePerdu}
      boutique={{ nom: boutique.nom, adresse: boutique.adresse, whatsapp: boutique.whatsapp }}
    />
  );
}
