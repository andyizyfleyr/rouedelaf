import { Suspense } from "react";
import { redirect } from "next/navigation";

import { EcranRoue } from "@/components/client/EcranRoue";
import { sql } from "@/lib/db";
import { construireCases } from "@/lib/roue";
import { lireSessionJeu } from "@/lib/session";
import { chargerCadeauxRoue } from "@/server/tirage";
import { toursRestants } from "@/server/tirage";

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

/** Coquille statique : la roue apparaît immédiatement (même en 3G). */
function SqueletteRoue() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10">
      <div className="size-[78vw] max-w-[420px] animate-pulse rounded-full border border-or/15 bg-gradient-to-br from-white/5 to-transparent" />
      <p className="text-[12px] tracking-[0.2em] text-cendre/50 uppercase">Préparation de la roue…</p>
    </div>
  );
}

async function Contenu() {
  const session = await lireSessionJeu();
  if (!session) redirect("/jouer");

  // Plus de tour disponible : on renvoie vers le résultat déjà obtenu.
  const restants = await toursRestants(session.participantId);
  if (restants <= 0) {
    const [dernier] = await sql`
      SELECT id FROM tirages WHERE participant_id = ${session.participantId}
      ORDER BY created_at DESC, id DESC LIMIT 1
    `;
    if (dernier) redirect(`/resultat?t=${dernier.id}`);
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
      codeParrain={await codeParrain(session.participantId)}
    />
  );
}

async function codeParrain(participantId: number): Promise<string | null> {
  const [ligne] = await sql`
    SELECT code_parrain FROM participants WHERE id = ${participantId}
  `;
  return (ligne?.code_parrain as string | undefined) ?? null;
}
