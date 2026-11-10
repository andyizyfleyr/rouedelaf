import { NextResponse } from "next/server";

import { ErreurMetier, traduireErreur } from "@/lib/db";
import { verifierLimite, prendreVerrou, libererVerrou } from "@/lib/rate-limit";
import { lireSessionJeu } from "@/lib/session";
import { empreinteAppareil, hasherIp, lireIp } from "@/server/contexte";
import { assurerSchema } from "@/server/init";
import { effectuerTirage } from "@/server/tirage";

/**
 * POST /api/tirage — LE TIRAGE (décision serveur uniquement)
 *
 * Réponse :
 *   { tirageId, statut, caseIndex, nombreCases, cadeau, code, expireLe }
 *
 * Sécurité :
 *  - session de jeu obligatoire (cookie httpOnly signé, vérifié en base) ;
 *  - verrou anti double-clic (Upstash, 15 s) ;
 *  - limite par IP et par appareil ;
 *  - le tirage est enregistré AVANT l'animation.
 */
export async function POST(request: Request) {
  const session = await lireSessionJeu();
  if (!session) {
    return NextResponse.json(
      { erreur: "Votre session a expiré. Rechargez la page.", code: "SESSION" },
      { status: 401 },
    );
  }

  const ipHash = hasherIp(lireIp(request));
  const appareil = empreinteAppareil(request);

  // Limites : IP (12 / 10 min) et appareil (6 / 10 min).
  const limiteIp = await verifierLimite("tirage", `ip:${ipHash}`);
  const limiteAppareil = await verifierLimite("tirage", `dev:${appareil}`);
  if (!limiteIp.ok || !limiteAppareil.ok) {
    return NextResponse.json(
      {
        erreur: "Trop de tirages depuis cet appareil. Réessayez plus tard.",
        code: "LIMITE",
      },
      { status: 429 },
    );
  }

  // Verrou anti double-clic (un seul tirage à la fois par participant).
  const cleVerrou = `tirage:${session.participantId}`;
  const verrou = await prendreVerrou(cleVerrou, 20);
  if (!verrou) {
    return NextResponse.json(
      { erreur: "Un tirage est déjà en cours…", code: "VERROU" },
      { status: 409 },
    );
  }

  try {
    // Filet de sécurité : si la base a été réinitialisée entre l'inscription et
    // le tirage, le schéma est recréé au lieu d'échouer en 500.
    await assurerSchema();

    const resultat = await effectuerTirage(session.participantId, {
      appareil,
      ipHash,
    });

    return NextResponse.json(resultat, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof ErreurMetier) {
      const statut =
        e.code === "BLOQUE" ? 403 : e.code === "NON_TROUVE" ? 404 : 409;
      return NextResponse.json({ erreur: e.message, code: e.code }, { status: statut });
    }
    const traduit = traduireErreur(e);
    return NextResponse.json({ erreur: traduit.message }, { status: 500 });
  } finally {
    await libererVerrou(cleVerrou);
  }
}
