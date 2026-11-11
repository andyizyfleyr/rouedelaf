import { connection, NextResponse } from "next/server";

import { lireSessionAdmin } from "@/lib/session";
import { detourerImagesExistantes } from "@/server/images";

/**
 * POST /api/admin/detourage — détoure les photos produits déjà en base.
 *
 * Pourquoi cette route existe : le détourage automatique (fond uni → PNG
 * transparent) ne s'applique qu'aux photos ENVOYÉES APRÈS son arrivée. Les
 * photos déjà présentes — celles de la boutique en production — gardent leur
 * fond blanc, et la roue les découpe en biseau dans le secteur : c'est le
 * « pas joli » signalé par l'exploitant.
 *
 * Le traitement est borné (quelques images par appel) : une fonction
 * serverless a un temps limité. La route se rappelle donc jusqu'à ce qu'il
 * n'y ait plus rien à faire, et renvoie le décompte pour que l'admin le voie.
 *
 * Sécurité : réservée à une session admin (cookie signé), comme /api/admin/init.
 */
export async function POST(request: Request) {
  await connection();

  const session = await lireSessionAdmin();
  if (!session) {
    return NextResponse.json({ erreur: "non autorisé" }, { status: 401 });
  }

  const limite = Math.min(
    12,
    Math.max(1, Number(new URL(request.url).searchParams.get("limite") ?? 6) || 6),
  );

  try {
    const resultat = await detourerImagesExistantes(limite);
    return NextResponse.json({ ok: true, ...resultat });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[detourage] échec", message);
    return NextResponse.json({ ok: false, erreur: message.split("\n")[0] }, { status: 500 });
  }
}
