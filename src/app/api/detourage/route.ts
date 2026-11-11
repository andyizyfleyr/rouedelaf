import { connection, NextResponse } from "next/server";

import { detourerImagesExistantes } from "@/server/images";

/**
 * POST /api/detourage — détoure les photos produits en attente.
 *
 * Pourquoi une route PUBLIQUE (pas d'authentification) : elle ne touche à
 * aucune donnée métier. Elle ne traite que des images dont le détourage est
 * encore à faire, en nombre borné, et devient un no-op une fois le catalogue
 * à jour. En revanche elle est indispensable SANS session : la roue est
 * l'écran affiché en boutique, et l'exploitant n'ouvre pas forcément l'admin.
 *
 * Pourquoi pas `after()` dans la page roue : la page est prérendue (PPR), donc
 * servie depuis le cache — son code ne s'exécute pas à chaque visite, et le
 * travail différé ne partait jamais. Un appel depuis le navigateur, lui, est
 * déterministe.
 *
 * Idempotence et sécurité :
 *  • chaque image traitée est marquée (`detoure_le`), jamais reprise ;
 *  • quota de 4 images par appel, temps d'exécution borné ;
 *  • une erreur ne renvoie jamais de détail interne.
 */
export async function POST() {
  await connection();

  try {
    const resultat = await detourerImagesExistantes(4);
    return NextResponse.json({ ok: true, ...resultat });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
