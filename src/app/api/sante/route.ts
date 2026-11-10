import { NextResponse } from "next/server";

import { etatSchema } from "@/lib/db";

/**
 * GET /api/sante — état public (donc sans secret) de la base.
 *
 * Sert après un déploiement : vérifie que les migrations sont passées et que
 * le schéma accepte bien un tirage sans participant (gain anonyme), sans
 * écrire quoi que ce soit.
 *
 * Ne divulgue que des faits de schéma, jamais une chaîne de connexion ni une
 * donnée client. Mis en cache quelques secondes pour ne pas interroger la base
 * à chaque appel.
 */
export async function GET() {
  const etat = await etatSchema();
  return NextResponse.json(etat, {
    headers: { "cache-control": "no-store" },
  });
}
