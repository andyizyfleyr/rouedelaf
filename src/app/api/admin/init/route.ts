import { connection, NextResponse } from "next/server";

import { lireSessionAdmin } from "@/lib/session";
import { initialiserBase } from "@/server/init";

/**
 * POST /api/admin/init — prépare la base de données.
 *
 * Pourquoi une route et pas seulement `npm run db:setup` ?
 *  - Le script local exige un accès TCP/SQL depuis le poste de travail. Sur
 *    certains réseaux (proxy d'entreprise, sandbox, wifi public), cet accès
 *    est bloqué alors que Vercel joint la même base sans problème.
 *  - Cette route exécute donc le MÊME fichier SQL (sql/schema.sql) depuis
 *    Vercel.
 *
 * Sécurité :
 *  - Réservée à une session admin (cookie signé).
 *  - Si les tables existent déjà et contiennent des cadeaux, la route refuse
 *    tout sauf un `?forcer=1` explicite : impossible d'écraser une base en
 *    production par erreur.
 *  - Le SQL est idempotent (CREATE TABLE IF NOT EXISTS / ON CONFLICT).
 */
export async function POST(request: Request) {
  await connection();

  const session = await lireSessionAdmin();
  if (!session) {
    return NextResponse.json({ erreur: "non autorisé" }, { status: 401 });
  }

  const forcer = new URL(request.url).searchParams.get("forcer") === "1";

  try {
    return NextResponse.json(await initialiserBase({ forcer }));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[init] échec", message);
    return NextResponse.json({ ok: false, erreur: message.split("\n")[0] }, { status: 500 });
  }
}
