import "server-only";

import { sql } from "@/lib/db";

/**
 * Journal d'audit : trace les actions sensibles (connexion admin, remise de
 * cadeau, modification du catalogue). Sert à la fois de sécurité et de
 * mémoire de la boutique.
 */

export type LigneJournal = {
  id: number;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};

export async function listerJournal(limite = 25): Promise<LigneJournal[]> {
  try {
    const lignes = await sql`
      SELECT id, action, details, created_at
      FROM journal_admin
      ORDER BY created_at DESC
      LIMIT ${limite}
    `;
    return (lignes as LigneJournal[]).map((l) => ({ ...l, id: Number(l.id) }));
  } catch (e) {
    console.error("[audit] lecture impossible", e);
    return [];
  }
}
