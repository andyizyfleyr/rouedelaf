import "server-only";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import { env } from "./env";

/**
 * Codes OTP à 6 chiffres envoyés par WhatsApp.
 *
 * - Générés avec `crypto.randomInt` (jamais Math.random).
 * - Jamais stockés en clair : on garde un hash HMAC-ish (sha256 + poivre).
 * - Comparaison en temps constant.
 * - 5 tentatives max, validité 10 minutes.
 */

export function genererCodeOtp(): string {
  // 100000 → 999999 : toujours 6 chiffres, sans biais modulo.
  return String(randomInt(100_000, 1_000_000));
}

export function hacherOtp(code: string, telephone: string): string {
  return createHash("sha256")
    .update(`${env.otpPepper}:${telephone}:${code}`)
    .digest("hex");
}

export function comparerOtp(hashStocke: string, code: string, telephone: string): boolean {
  const candidat = hacherOtp(code, telephone);
  const a = Buffer.from(hashStocke, "hex");
  const b = Buffer.from(candidat, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Message WhatsApp envoyé au client (texte brut, français simple). */
export function messageOtp(code: string, minutes: number): string {
  return `Votre code de vérification est ${code}. Il est valable ${minutes} minutes. Ne le partagez avec personne. — ${process.env.NEXT_PUBLIC_BOUTIQUE_NOM ?? "La Roue de la Fortune"}`;
}
