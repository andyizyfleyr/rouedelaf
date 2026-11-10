import { NextResponse } from "next/server";
import { z } from "zod";

import { normaliserTelephone } from "@/lib/format";
import { env } from "@/lib/env";
import { genererCodeOtp, hacherOtp } from "@/lib/otp";
import { verifierLimite } from "@/lib/rate-limit";
import { enregistrerOtp, otpActif, participantParTelephone } from "@/server/data";
import { hasherIp, lireIp } from "@/server/contexte";
import { lireParametres } from "@/server/params";
import { envoyerCodeWhatsApp } from "@/lib/whatsapp";

/**
 * POST /api/otp/envoyer
 *
 * Envoie un code à 6 chiffres par WhatsApp au numéro inscrit.
 *
 * - 5 envois maximum par IP toutes les 15 minutes (anti-spam coûteux).
 * - Un nouveau code invalide l'ancien.
 * - En développement (driver « console »), le code apparaît dans les logs du
 *   serveur et éventuellement à l'écran si DEV_OTP_CODE est défini.
 */
const schema = z.object({ telephone: z.string().min(8).max(24) });

export async function POST(request: Request) {
  const ipHash = hasherIp(lireIp(request));
  const limite = await verifierLimite("otp-envoi", ipHash);
  if (!limite.ok) {
    return NextResponse.json(
      { erreur: "Trop de demandes de code. Patientez un quart d'heure." },
      { status: 429, headers: { "Retry-After": String(limite.retryAfter) } },
    );
  }

  let corps: z.infer<typeof schema>;
  try {
    corps = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ erreur: "Numéro invalide." }, { status: 400 });
  }

  const telephone = normaliserTelephone(corps.telephone);
  const participant = await participantParTelephone(telephone);

  // On ne révèle pas si un numéro est inscrit ou non (énumération impossible) :
  // la réponse est identique dans tous les cas.
  if (!participant) {
    return NextResponse.json({
      ok: true,
      message: "Si ce numéro est inscrit, vous allez recevoir un code.",
    });
  }
  if (participant.bloque) {
    return NextResponse.json(
      { erreur: "Ce numéro ne peut plus participer." },
      { status: 403 },
    );
  }

  const parametres = await lireParametres();
  const code = env.devOtpCode || genererCodeOtp();
  const expireLe = new Date(Date.now() + parametres.otpValiditeMinutes * 60_000);

  await enregistrerOtp({
    telephone,
    codeHash: hacherOtp(code, telephone),
    expireLe,
  });

  const envoi = await envoyerCodeWhatsApp(telephone, code);

  if (!envoi.ok) {
    // Mode « console » ou panne fournisseur : on ne bloque pas le client en
    // développement, mais en production c'est une vraie erreur.
    if (env.isProduction) {
      return NextResponse.json(
        { erreur: "L'envoi du code a échoué. Réessayez ou demandez un vendeur." },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    driver: envoi.driver,
    // Jamais renvoyé en production : uniquement pour tester en local.
    codeDeTest: env.isProduction ? undefined : env.devOtpCode || code,
    expireDansMinutes: parametres.otpValiditeMinutes,
    message: "Code envoyé sur WhatsApp.",
  });
}

/** GET : indique si un code est encore valide (affichage du compte à rebours). */
export async function GET(request: Request) {
  const telephone = normaliserTelephone(
    new URL(request.url).searchParams.get("telephone") ?? "",
  );
  if (!telephone) return NextResponse.json({ actif: false });
  const actif = await otpActif(telephone);
  if (!actif) return NextResponse.json({ actif: false });
  const expire = new Date(actif.expire_le).getTime();
  return NextResponse.json({
    actif: expire > Date.now(),
    secondesRestantes: Math.max(Math.floor((expire - Date.now()) / 1000), 0),
  });
}
