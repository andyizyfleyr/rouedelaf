import { NextResponse } from "next/server";

import { fluxBorne } from "@/server/data";

/**
 * GET /api/borne — flux PUBLIC et MINIMAL pour l'écran d'accueil boutique.
 *
 * ⚠️ Cette route est accessible sans authentification : elle ne doit exposer
 * AUCUNE donnée personnelle : le jeu n'en collecte plus. `fluxBorne()` ne
 * renvoie que :
 *   - le nom du cadeau gagné et sa couleur,
 *   - l'horodatage et les compteurs agrégés.
 *
 * Le cache HTTP de 10 s évite qu'une tablette qui rafraîchit toutes les
 * 15 s ne martèle la base.
 */
export async function GET() {
  try {
    return NextResponse.json(await fluxBorne(), {
      headers: { "Cache-Control": "public, max-age=10, s-maxage=10" },
    });
  } catch (e) {
    console.error("[borne] lecture impossible", e);
    // La borne ne doit jamais afficher une erreur : on dégrade proprement.
    return NextResponse.json(
      { gagnants: [], totaux: { tirages: 0, gagnes: 0 } },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
