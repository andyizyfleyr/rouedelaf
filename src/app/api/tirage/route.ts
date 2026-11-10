import { NextResponse } from "next/server";

import { ErreurMetier, traduireErreur } from "@/lib/db";
import { prendreVerrou, libererVerrou } from "@/lib/rate-limit";
import { empreinteAppareil, hasherIp, lireIp } from "@/server/contexte";
import { effectuerTirage } from "@/server/tirage";

/**
 * POST /api/tirage — LE TIRAGE (décision serveur uniquement)
 *
 * Réponse : { tirageId, statut, caseIndex, nombreCases, cadeau, code, expireLe }
 *
 * Ce que ce tour N'EST PAS : une partie de compte. Le jeu tourne sur le poste
 * de la boutique, ouvert à qui se présente — pas de cookie de session, pas de
 * participant, pas de « tours restants ». Conséquence directe : un même poste
 * peut enchaîner les clients, et un rechargement de page ne ressuscite jamais
 * la partie précédente.
 *
 * Ce qui protège malgré tout le stock :
 *  - verrou anti double-clic (un seul tirage à la fois sur le poste) ;
 *  - enregistrement ATOMIQUE en base (décrément conditionnel du stock) ;
 *  - réglage « Jeu ouvert » côté administration.
 */
export async function POST(request: Request) {
  const ipHash = hasherIp(lireIp(request));
  const appareil = empreinteAppareil(request);

  // Verrou anti double-clic : un seul tirage à la fois sur le poste. Sans
  // limite de tours, c'est la seule barrière contre deux clics simultanés.
  const cleVerrou = `tirage:poste`;
  const verrou = await prendreVerrou(cleVerrou, 20);
  if (!verrou) {
    return NextResponse.json(
      { erreur: "Un tirage est déjà en cours…", code: "VERROU" },
      { status: 409 },
    );
  }

  try {
    const resultat = await effectuerTirage({ appareil, ipHash });

    return NextResponse.json(resultat, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof ErreurMetier) {
      const statut =
        e.code === "BLOQUE"
          ? 403
          : e.code === "NON_TROUVE"
            ? 404
            : e.code === "AUCUN_LOT"
              ? 409
              : 409;
      return NextResponse.json({ erreur: e.message, code: e.code }, { status: statut });
    }
    const traduit = traduireErreur(e);
    return NextResponse.json({ erreur: traduit.message }, { status: 500 });
  } finally {
    await libererVerrou(cleVerrou);
  }
}
