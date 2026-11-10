import { connection, NextResponse } from "next/server";

import { lireSessionAdmin } from "@/lib/session";
import { listerGagnantsRecents, statistiques } from "@/server/data";

/**
 * GET /api/admin/ecran — flux de l'écran boutique (polling).
 *
 * Pourquoi un polling et pas du Realtime ?
 *  - Neon ne propose pas de Realtime « pub/sub » client ; il faut un service
 *    tiers ou un WebSocket. Un polling de 8 secondes est plus fiable sur le
 *    réseau mobile béninois, consomme très peu (une requête SQL indexée) et
 *    fonctionne derrière n'importe quel proxy.
 *  - Si vous ajoutez plus tard un service Realtime, remplacez simplement ce
 *    composant : la forme de la réponse ne changera pas.
 *
 * Protection : session admin obligatoire.
 */
export async function GET() {
  // `connection()` marque la route comme dépendante de la requête : Next.js
  // ne tente plus de la prérendre au build (cookies() échouerait hors requête).
  await connection();

  try {
    const session = await lireSessionAdmin();
    if (!session) return NextResponse.json({ erreur: "non autorisé" }, { status: 401 });

    const [gagnants, stats] = await Promise.all([listerGagnantsRecents(12), statistiques()]);

    return NextResponse.json(
      {
        gagnants,
        totaux: {
          tirages: stats.tiragesTotal,
          gagnes: stats.gagnesTotal,
          recuperes: stats.recuperesTotal,
        },
        horodatage: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    // L'écran boutique ne doit jamais rester bloqué sur une erreur brute :
    // on renvoie un état vide exploitable par le client + le détail en log.
    console.error("[ecran] lecture impossible", e);
    return NextResponse.json(
      { gagnants: [], totaux: { tirages: 0, gagnes: 0, recuperes: 0 }, horodatage: new Date().toISOString() },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
