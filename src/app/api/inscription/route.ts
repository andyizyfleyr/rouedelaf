import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { ErreurMetier, traduireErreur } from "@/lib/db";
import {
  formaterTelephone,
  longueursAttendues,
  normaliserSource,
  normaliserTelephone,
  telephoneLocalValide,
} from "@/lib/format";
import { verifierLimite } from "@/lib/rate-limit";
import {
  creerParticipant,
  creerSessionEnBase,
  crediterParrainage,
  participantParCodeParrain,
  participantParTelephone,
} from "@/server/data";
import {
  creerSessionJeu,
  hacherToken,
  nouveauTokenSession,
} from "@/lib/session";
import { lireParametres } from "@/server/params";
import { empreinteAppareil, hasherIp, lireIp } from "@/server/contexte";

/**
 * POST /api/inscription
 *
 * Étape 1 du jeu : le client saisit son nom + son numéro WhatsApp.
 *
 * - Le numéro est normalisé (229XXXXXXXX).
 * - Un numéro déjà inscrit n'obtient PAS une seconde participation : on lui
 *   renvoie le message « déjà participé » (1 participation par numéro).
 * - En cas de succès, la session de jeu est ouverte ICI (cookie signé + ligne
 *   en base). Il n'y a plus de code de vérification par WhatsApp : l'inscription
 *   débouche directement sur la roue.
 * - Limitation par IP (5 inscriptions / 10 min) et empreinte d'appareil.
 */
const schema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, "Votre nom doit contenir au moins 2 lettres.")
    .max(80, "Nom trop long.")
    .regex(/^[\p{L}\p{M}\s'’.-]+$/u, "Utilisez uniquement des lettres pour votre nom."),
  telephone: z.string().trim().min(8, "Numéro trop court.").max(24, "Numéro trop long."),
  source: z.string().trim().max(40).optional(),
  consentement: z.boolean().optional().default(true),
  /** Code de parrainage de l'ami qui a partagé le lien (facultatif). */
  ref: z.string().trim().max(16).optional(),
});

export async function POST(request: Request) {
  const ip = lireIp(request);
  const ipHash = hasherIp(ip);
  const appareil = empreinteAppareil(request);

  // Anti-spam : limite par IP (la plus fiable derrière un proxy).
  const limite = await verifierLimite("inscription", ipHash);
  if (!limite.ok) {
    return NextResponse.json(
      {
        erreur: "Trop de tentatives depuis cet appareil. Réessayez dans quelques minutes.",
        retryAfter: limite.retryAfter,
      },
      { status: 429, headers: { "Retry-After": String(limite.retryAfter) } },
    );
  }

  let donnees: z.infer<typeof schema>;
  try {
    donnees = schema.parse(await request.json());
  } catch (e) {
    const message =
      e instanceof z.ZodError ? (e.issues[0]?.message ?? "Données invalides.") : "Données invalides.";
    return NextResponse.json({ erreur: message }, { status: 400 });
  }

  const telephone = normaliserTelephone(donnees.telephone);
  // Longueur contrôlée PAR PAYS, pas seulement « entre 8 et 15 chiffres » :
  // un numéro béninois de 13 chiffres était accepté et créait un client
  // impossible à joindre.
  const indicatifTrouve = ["229", "228", "234", "225", "226", "221"].find((i) =>
    telephone.startsWith(i),
  );
  const local = indicatifTrouve ? telephone.slice(indicatifTrouve.length) : telephone;
  const longueurOk = indicatifTrouve
    ? telephoneLocalValide(indicatifTrouve, local)
    : longueursAttendues("+").includes(telephone.length) ||
      (telephone.length >= 8 && telephone.length <= 15);
  if (telephone.length < 8 || telephone.length > 15 || !longueurOk) {
    return NextResponse.json(
      {
        erreur:
          "Numéro WhatsApp invalide. Exemple : 97 12 34 56 (10 chiffres au Bénin, en comptant le 01).",
      },
      { status: 400 },
    );
  }

  try {
    const existant = await participantParTelephone(telephone);
    if (existant) {
      if (existant.bloque) {
        return NextResponse.json(
          { erreur: "Ce numéro ne peut plus participer." },
          { status: 403 },
        );
      }
      return NextResponse.json(
        {
          dejaParticipant: true,
          erreur:
            "Ce numéro a déjà participé à la roue. Un seul tour par personne ! Revenez nous voir en boutique.",
        },
        { status: 409 },
      );
    }

    const { participant } = await creerParticipant({
      nom: donnees.nom,
      telephone,
      telephoneAff: formaterTelephone(telephone),
      source: normaliserSource(donnees.source),
      appareil,
      ipHash,
      consentement: donnees.consentement,
      codeParrain: genererCodeParrain(),
    });

    // Parrainage : le parrain gagne un tour bonus, une seule fois par filleul.
    let parrainageCredite = false;
    if (donnees.ref) {
      const parrain = await participantParCodeParrain(donnees.ref);
      if (parrain && parrain.id !== participant.id) {
        const parametres = await lireParametres();
        parrainageCredite = await crediterParrainage(
          donnees.ref,
          participant.id,
          parametres.toursBonusParrainage,
        );
      }
    }

    // Session ouverte immédiatement : plus d'étape de vérification par code.
    // On garde la ligne en base pour que l'admin puisse révoquer une session.
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
      participantId: Number(participant.id),
      telephoneMasque: participant.telephone_aff ?? formaterTelephone(telephone),
      parrainageCredite,
    });
  } catch (e) {
    if (e instanceof ErreurMetier && e.code === "DEJA_PARTICIPE") {
      return NextResponse.json(
        { erreur: "Ce numéro a déjà participé. Un seul tour par personne !" },
        { status: 409 },
      );
    }
    const traduit = traduireErreur(e);
    return NextResponse.json({ erreur: traduit.message }, { status: 500 });
  }
}

/** Code de parrainage lisible : R + 6 caractères (sans I/O/0/1). */
function genererCodeParrain(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const octets = randomBytes(6);
  let code = "R";
  for (const octet of octets) code += alphabet[octet % alphabet.length];
  return code;
}
