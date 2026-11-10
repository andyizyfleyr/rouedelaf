"use client";

/**
 * Événements marketing (Meta Pixel + TikTok Pixel).
 *
 * Les pixels ne sont chargés que si les identifiants sont configurés dans
 * .env.local. `suivreEvenement` est sans effet sinon (aucune erreur).
 *
 * Événements utilisés :
 *  - joue_debut       : arrivée sur /jouer (PageView + ViewContent)
 *  - joue_inscription : formulaire validé (CompleteRegistration / Lead)
 *  - joue_victoire    : cadeau gagné (Purchase / CompletePayment)
 *  - joue_partage     : clic sur « partager à un ami » (Share)
 */

type Evenement = "joue_debut" | "joue_inscription" | "joue_victoire" | "joue_partage";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (nom: string, params?: Record<string, unknown>) => void };
  }
}

const EQUIVALENTS_META: Record<Evenement, string> = {
  joue_debut: "ViewContent",
  joue_inscription: "CompleteRegistration",
  joue_victoire: "Purchase",
  joue_partage: "Contact",
};

const EQUIVALENTS_TIKTOK: Record<Evenement, string> = {
  joue_debut: "ViewContent",
  joue_inscription: "CompleteRegistration",
  joue_victoire: "CompletePayment",
  joue_partage: "ClickButton",
};

export function suivreEvenement(nom: Evenement, details: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;

  try {
    window.fbq?.("track", EQUIVALENTS_META[nom], details);
  } catch {
    /* pixel bloqué : on ignore */
  }

  try {
    window.ttq?.track(EQUIVALENTS_TIKTOK[nom], details);
  } catch {
    /* idem */
  }

  // Trace locale utile en développement.
  if (process.env.NODE_ENV !== "production") {
    console.info(`[pixel] ${nom}`, details);
  }
}
