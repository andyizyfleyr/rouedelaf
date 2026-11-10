import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { normaliserTelephone } from "@/lib/format";
import { comparerOtp } from "@/lib/otp";
import { verifierLimite } from "@/lib/rate-limit";
import {
  consommerOtp,
  creerSessionEnBase,
  incrementerTentativesOtp,
  otpActif,
  participantParTelephone,
} from "@/server/data";
import { hasherIp, lireIp } from "@/server/contexte";
import { lireParametres } from "@/server/params";
import { creerSessionJeu, nouveauTokenSession, hacherToken } from "@/lib/session";

/**
 * POST /api/otp/verifier
 *
 * Vérifie le code reçu sur WhatsApp puis OU VRE la session de jeu.
 *
 * Sécurité :
 *  - 10 essais par IP / 15 min (Upstash) ;
 *  - 5 essais par code (compteur en base) ;
 *  - expiration 10 min ;
 *  - comparaison en temps constant ;
 *  - le code est invalidé après succès (usage unique).
 */
const schema = z.object({
  telephone: z.string().min(8).max(24),
  code: z.string().trim().regex(/^\d{6}$/, "Le code contient 6 chiffres."),
});

export async function POST(request: Request) {
  const ipHash = hasherIp(lireIp(request));
  const limite = await verifierLimite("otp-verif", ipHash);
  if (!limite.ok) {
    return NextResponse.json(
      { erreur: "Trop d'essais. Réessayez dans quelques minutes." },
      { status: 429, headers: { "Retry-After": String(limite.retryAfter) } },
    );
  }

  let corps: z.infer<typeof schema>;
  try {
    corps = schema.parse(await request.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message : "Données invalides.";
    return NextResponse.json({ erreur: message }, { status: 400 });
  }

  const telephone = normaliserTelephone(corps.telephone);
  const parametres = await lireParametres();

  const otp = await otpActif(telephone);
  if (!otp) {
    return NextResponse.json(
      { erreur: "Aucun code en cours. Demandez un nouveau code." },
      { status: 400 },
    );
  }

  if (new Date(otp.expire_le).getTime() < Date.now()) {
    await consommerOtp(otp.id);
    return NextResponse.json(
      { erreur: "Ce code a expiré. Demandez-en un nouveau." },
      { status: 400 },
    );
  }

  if (otp.tentatives >= parametres.otpTentativesMax) {
    await consommerOtp(otp.id);
    return NextResponse.json(
      { erreur: "Trop d'essais sur ce code. Demandez-en un nouveau." },
      { status: 429 },
    );
  }

  if (!comparerOtp(otp.code_hash, corps.code, telephone)) {
    const tentatives = await incrementerTentativesOtp(otp.id);
    const restantes = Math.max(parametres.otpTentativesMax - tentatives, 0);
    return NextResponse.json(
      {
        erreur:
          restantes > 0
            ? `Code incorrect. Il vous reste ${restantes} essai${restantes > 1 ? "s" : ""}.`
            : "Code incorrect. Demandez un nouveau code.",
        essaisRestants: restantes,
      },
      { status: 400 },
    );
  }

  const participant = await participantParTelephone(telephone);
  if (!participant) {
    return NextResponse.json(
      { erreur: "Ce numéro n'est pas inscrit. Recommencez l'inscription." },
      { status: 404 },
    );
  }
  if (participant.bloque) {
    return NextResponse.json({ erreur: "Ce numéro ne peut plus participer." }, { status: 403 });
  }

  // Code consommé : usage unique, même si la session est perdue ensuite.
  await consommerOtp(otp.id);

  // Session : JWT signé + ligne en base (révocation possible par l'admin).
  const sid = nouveauTokenSession();
  const expireLe = new Date(Date.now() + 4 * 60 * 60 * 1000);
  await creerSessionEnBase({
    participantId: participant.id,
    tokenHash: hacherToken(sid),
    expireLe,
  });

  await creerSessionJeu({
    participantId: participant.id,
    nom: participant.nom,
    telephone: participant.telephone,
    sid,
  });

  return NextResponse.json({
    ok: true,
    participant: {
      nom: participant.nom,
      codeParrain: participant.code_parrain,
    },
    modeDeveloppement: !env.isProduction,
  });
}
