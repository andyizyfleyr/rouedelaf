import { connection, NextResponse } from "next/server";

import { verifierAntiAbus } from "@/lib/rate-limit";
import { lireSessionAdmin } from "@/lib/session";

/**
 * GET /api/admin/diagnostic — état des services externes.
 *
 * Répond à une question concrète : « l'anti-abus est-il vraiment actif ? ».
 * Sans ce contrôle, une variable mal nommée passe inaperçue et l'application
 * reste ouverte aux abus sans le moindre signe visible.
 *
 * Sécurité : réservé à une session admin (aucun secret n'est renvoyé, on ne
 * dit même pas quelle URL est utilisée).
 */
export async function GET() {
  await connection();

  const session = await lireSessionAdmin();
  if (!session) return NextResponse.json({ erreur: "non autorisé" }, { status: 401 });

  const antiAbus = await verifierAntiAbus();

  return NextResponse.json({
    antiAbus,
    base: {
      configuree: Boolean(process.env.DATABASE_URL),
      driver: /neon\.tech/i.test(process.env.DATABASE_URL ?? "")
        ? "neon-http"
        : "pg",
    },
    whatsapp: {
      driver: process.env.WHATSAPP_DRIVER || "console",
      envoiReel: (process.env.WHATSAPP_DRIVER || "console") !== "console",
    },
  });
}
