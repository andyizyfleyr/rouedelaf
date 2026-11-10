"use server";

import { revalidatePath } from "next/cache";

import { exigerAdmin } from "@/lib/session";
import { marquerRecupere, tirageParCode } from "@/server/data";
import { lireParametres } from "@/server/params";

/**
 * Server Action du scan boutique.
 *
 * 1. `chercherCode` : aperçu SANS écrire (nom, cadeau, validité) — la vendeuse
 *    vérifie avant de valider.
 * 2. `validerRemise` : marque le cadeau comme remis (écriture atomique, une
 *    seule fois : un code ne peut pas être utilisé deux fois).
 */

export type ApercuCode = {
  ok: boolean;
  raison?: "introuvable" | "deja" | "expire" | "perdu" | "auth";
  /** Nom du client — absent depuis que les tirages sont anonymes. */
  participantNom?: string;
  cadeauNom?: string;
  expireLe?: string;
  recupereLe?: string | null;
};

export async function chercherCode(brut: string): Promise<ApercuCode> {
  try {
    await exigerAdmin();
  } catch {
    return { ok: false, raison: "auth" };
  }

  const code = extraireCode(brut);
  if (!code) return { ok: false, raison: "introuvable" };

  const tirage = await tirageParCode(code);
  if (!tirage) return { ok: false, raison: "introuvable" };
  if (tirage.statut !== "gagne") return { ok: false, raison: "perdu" };
  if (tirage.recupere) return { ok: false, raison: "deja", participantNom: tirage.participant_nom ?? undefined, cadeauNom: tirage.cadeau_nom ?? undefined };
  if (new Date(tirage.expire_le).getTime() < Date.now()) {
    return {
      ok: false,
      raison: "expire",
      participantNom: tirage.participant_nom ?? undefined,
      cadeauNom: tirage.cadeau_nom ?? undefined,
      expireLe: tirage.expire_le,
    };
  }

  return {
    ok: true,
    participantNom: tirage.participant_nom ?? undefined,
    cadeauNom: tirage.cadeau_nom ?? undefined,
    expireLe: tirage.expire_le,
  };
}

export type ResultatRemise = {
  ok: boolean;
  message: string;
  raison?: string;
};

export async function validerRemise(brut: string): Promise<ResultatRemise> {
  try {
    await exigerAdmin();
  } catch {
    return { ok: false, message: "Session expirée. Reconnectez-vous.", raison: "auth" };
  }

  const code = extraireCode(brut);
  if (!code) return { ok: false, message: "Code invalide.", raison: "introuvable" };

  const resultat = await marquerRecupere(code);

  revalidatePath("/admin");
  revalidatePath("/admin/joueurs");

  if (!resultat.ok) {
    const messages: Record<string, string> = {
      introuvable: "Ce code n'existe pas. Vérifiez le QR ou saisissez le code à la main.",
      deja: "Ce cadeau a DÉJÀ été remis. Un code ne sert qu'une seule fois.",
      expire: "Ce code a expiré : le cadeau ne peut plus être remis.",
      perdu: "Ce tirage est perdant : aucun cadeau à remettre (bon de réduction uniquement).",
    };
    return { ok: false, message: messages[resultat.raison] ?? "Remise impossible.", raison: resultat.raison };
  }

  const parametres = await lireParametres();
  return {
    ok: true,
    // Plus de nom à annoncer (tirage anonyme) : on confirme le cadeau remis.
    message: `${resultat.cadeauNom} remis. Validité du code : ${parametres.dureeValiditeCodeJours} jours.`,
  };
}

/** Accepte un QR contenant le code seul ou une URL du type /c/CODE. */
function extraireCode(brut: string): string | null {
  const valeur = brut.trim();
  if (!valeur) return null;
  const trouve = valeur.match(/ROUE-[A-Za-z0-9]{4}-[A-Za-z0-9]{2,4}/);
  if (trouve) return trouve[0].toUpperCase();
  // QR scanné depuis un ancien format : on tente la valeur brute.
  if (/^[A-Za-z0-9-]{6,24}$/.test(valeur)) return valeur.toUpperCase();
  return null;
}
