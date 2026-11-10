import { NextResponse } from "next/server";

import { supprimerSessionAdmin } from "@/lib/session";

/**
 * POST /api/admin/deconnexion — efface le cookie d'administration.
 * (Route dédiée plutôt qu'une Server Action : simple bouton de formulaire HTML.)
 */
export async function POST(request: Request) {
  await supprimerSessionAdmin();
  return NextResponse.redirect(new URL("/connexion", request.url), { status: 303 });
}
