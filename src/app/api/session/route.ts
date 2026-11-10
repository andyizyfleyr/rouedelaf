import { NextResponse } from "next/server";

import { lireSessionJeu, supprimerSessionJeu } from "@/lib/session";
import { lireParametres } from "@/server/params";
import { toursRestants } from "@/server/tirage";
import { sql } from "@/lib/db";

/**
 * GET  /api/session → état du joueur (pseudo, tours restants, dernier tirage)
 * DELETE /api/session → déconnexion (efface le cookie de jeu)
 *
 * Sert aux pages client pour savoir s'il faut afficher « Jouer » ou
 * « Voir mon résultat », sans exposer le numéro de téléphone complet.
 */
export async function GET() {
  const session = await lireSessionJeu();
  if (!session) return NextResponse.json({ connecte: false });

  const parametres = await lireParametres();

  try {
    const restants = await toursRestants(session.participantId);
    const [dernier] = await sql`
      SELECT id, statut FROM tirages
      WHERE participant_id = ${session.participantId}
      ORDER BY created_at DESC, id DESC LIMIT 1
    `;
    const [participant] = await sql`
      SELECT code_parrain, tours_bonus FROM participants WHERE id = ${session.participantId}
    `;

    return NextResponse.json({
      connecte: true,
      nom: session.nom,
      toursRestants: restants,
      toursBonus: Number(participant?.tours_bonus ?? 0),
      codeParrain: participant?.code_parrain ?? null,
      dernierTirageId: dernier ? Number(dernier.id) : null,
      jeuOuvert: parametres.activeJeu,
    });
  } catch {
    // Participant supprimé / base indisponible : on traite comme déconnecté.
    return NextResponse.json({ connecte: false });
  }
}

export async function DELETE() {
  await supprimerSessionJeu();
  return NextResponse.json({ ok: true });
}
