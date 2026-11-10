import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { lireSessionJeu } from "@/lib/session";
import { tirageParCode } from "@/server/data";

/**
 * GET /api/qr?code=ROUE-XXXX-YY — QR d'un code cadeau déjà gagné.
 *
 * Pourquoi une route dédiée ? La popup de résultat n'a le QR que du dernier
 * gain (le serveur le prépare à l'avance). Dès qu'un joueur peut gagner
 * plusieurs cadeaux, il doit pouvoir rouvrir le QR de chacun : on le génère
 * ici, à la demande, et seulement pour un code qui appartient au joueur
 * connecté (sinon n'importe qui pourrait fabriquer un QR valide).
 */
export async function GET(request: Request) {
  const session = await lireSessionJeu();
  if (!session) return NextResponse.json({ erreur: "Session expirée." }, { status: 401 });

  const url = new URL(request.url);
  const code = (url.searchParams.get("code") ?? "").trim();
  if (!code) return NextResponse.json({ erreur: "Code manquant." }, { status: 400 });

  const tirage = await tirageParCode(code);
  // Un joueur ne peut obtenir que SES codes.
  if (!tirage || tirage.participant_id !== session.participantId) {
    return NextResponse.json({ erreur: "Code introuvable." }, { status: 404 });
  }
  if (tirage.statut !== "gagne" || !tirage.code_unique) {
    return NextResponse.json({ erreur: "Ce tirage n'a pas de cadeau." }, { status: 404 });
  }

  const qrDataUrl = await QRCode.toDataURL(tirage.code_unique, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 420,
    color: { dark: "#0a0908", light: "#f8e7a8" },
  });

  return NextResponse.json({ qrDataUrl }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
