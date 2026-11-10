import { NextResponse } from "next/server";

import { sql } from "@/lib/db";
import { verifierLimite } from "@/lib/rate-limit";
import { lireSessionJeu } from "@/lib/session";
import { hasherIp, lireIp } from "@/server/contexte";
import { lireParametres } from "@/server/params";

/**
 * /api/parrainage
 *
 * GET → renvoie le lien de partage WhatsApp du participant.
 *
 * Le tour bonus n'est JAMAIS accordé en visitant un lien : il est crédité à
 * l'inscription du filleul (avec un code valide), dans /api/inscription.
 * Voir crediterParrainage() dans src/server/data.ts.
 */
export async function GET(request: Request) {
  const session = await lireSessionJeu();
  if (!session) return NextResponse.json({ erreur: "Session expirée." }, { status: 401 });

  const limite = await verifierLimite("test", hasherIp(lireIp(request)));
  if (!limite.ok) return NextResponse.json({ erreur: "Trop de requêtes." }, { status: 429 });

  const [participant] = await sql`
    SELECT code_parrain FROM participants WHERE id = ${session.participantId}
  `;
  if (!participant?.code_parrain) {
    return NextResponse.json({ erreur: "Code de parrainage indisponible." }, { status: 404 });
  }

  const parametres = await lireParametres();
  const base = new URL(request.url).origin;
  const lien = `${base}/jouer?ref=${participant.code_parrain}`;

  const texte = encodeURIComponent(
    `Je tente ma chance à la Roue de Noël 🎄 Tourne la roue et gagne un cadeau à retirer en boutique : ${lien}`,
  );

  return NextResponse.json({
    lien,
    code: participant.code_parrain,
    toursBonusParrainage: parametres.toursBonusParrainage,
    whatsapp: `https://wa.me/?text=${texte}`,
  });
}
