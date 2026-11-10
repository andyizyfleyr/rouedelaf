"use server";

import { timingSafeEqual } from "node:crypto";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { env } from "@/lib/env";
import { verifierLimite } from "@/lib/rate-limit";
import { creerSessionAdmin, supprimerSessionAdmin } from "@/lib/session";
import { journaliser } from "@/server/data";

/**
 * Connexion administrateur (Server Action).
 *
 * - Mot de passe unique (ADMIN_PASSWORD), comparé en temps constant.
 * - 20 essais / 15 min par IP (Upstash) : impossible de brute-forcer.
 * - Session : cookie httpOnly signé, 12 h.
 */

export type EtatConnexion = { erreur?: string };

export async function connecterAdmin(
  _etat: EtatConnexion,
  formData: FormData,
): Promise<EtatConnexion> {
  const motDePasse = String(formData.get("motDePasse") ?? "");
  const suite = String(formData.get("suite") ?? "/admin");

  const entetes = await headers();
  const ip = entetes.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
  const limite = await verifierLimite("admin", `ip:${ip}`);

  if (!limite.ok) {
    return { erreur: "Trop de tentatives. Réessayez dans un quart d'heure." };
  }

  if (!motDePasse || !egalConstant(motDePasse, env.adminPassword)) {
    await journaliser("connexion_admin_echec", { ip: ip.slice(0, 12) });
    return { erreur: "Mot de passe incorrect." };
  }

  await creerSessionAdmin();
  await journaliser("connexion_admin", {});
  redirect(suite.startsWith("/admin") ? suite : "/admin");
}

export async function deconnecterAdmin(): Promise<void> {
  await supprimerSessionAdmin();
  redirect("/connexion");
}

/** Comparaison à temps constant (évite les attaques par chronométrage). */
function egalConstant(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // On compare quand même pour ne pas révéler la longueur.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
