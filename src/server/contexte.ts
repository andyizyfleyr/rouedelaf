import "server-only";

import { createHash } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Contexte d'une requête : IP et empreinte d'appareil, TOUJOURS hachées.
 *
 * On ne stocke jamais une IP en clair (RGPD + bonnes pratiques) : on garde un
 * hash salé, suffisant pour détecter les abus et faire des statistiques.
 */

const sel = () => `${env.otpPepper}:contexte`;

/** Extrait l'IP réelle derrière le proxy Vercel. */
export function lireIp(request: Request): string {
  const entetes = request.headers;
  const forwarded = entetes.get("x-forwarded-for");
  if (forwarded) {
    const premiere = forwarded.split(",")[0]?.trim();
    if (premiere) return premiere;
  }
  return (
    entetes.get("x-real-ip") ??
    entetes.get("cf-connecting-ip") ??
    entetes.get("x-vercel-forwarded-for") ??
    "0.0.0.0"
  );
}

/** Hash stable de l'IP (jamais réversible en pratique). */
export function hasherIp(ip: string): string {
  return createHash("sha256").update(`${sel()}:ip:${ip}`).digest("hex").slice(0, 32);
}

/**
 * Empreinte d'appareil : identifiant généré par le navigateur (localStorage)
 * + User-Agent + langue. Ce n'est pas une authentification, seulement un
 * signal anti-abus (un même téléphone qui rejoue 20 fois sera bloqué).
 */
export function empreinteAppareil(request: Request): string {
  const idClient = request.headers.get("x-appareil") ?? "";
  const ua = request.headers.get("user-agent") ?? "";
  const langue = request.headers.get("accept-language") ?? "";
  return createHash("sha256")
    .update(`${sel()}:dev:${idClient}|${ua}|${langue}`)
    .digest("hex")
    .slice(0, 32);
}

/** Récupère une valeur d'en-tête de façon sûre. */
export function entete(request: Request, nom: string): string | null {
  return request.headers.get(nom);
}
