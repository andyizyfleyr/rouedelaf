"use client";

/**
 * Identifiant d'appareil (anti-abus).
 *
 * Ce n'est PAS une authentification : c'est un identifiant aléatoire stocké
 * dans le navigateur, envoyé dans l'en-tête `x-appareil`. Le serveur le hache
 * avec le User-Agent pour détecter les abus (même téléphone qui rejoue).
 *
 * En cas de navigation privée ou de stockage bloqué, on retombe sur une valeur
 * volatile : l'application fonctionne quand même (la limite par IP prend le relais).
 */

const CLE = "roue:appareil";

let cache: string | null = null;

export function identifiantAppareil(): string {
  if (typeof window === "undefined") return "";
  if (cache) return cache;

  try {
    const existant = window.localStorage.getItem(CLE);
    if (existant && existant.length >= 16) {
      cache = existant;
      return existant;
    }
    const nouveau =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
            .toString(36)
            .slice(2)}`;
    window.localStorage.setItem(CLE, nouveau);
    cache = nouveau;
    return nouveau;
  } catch {
    cache = `volatile-${Math.random().toString(36).slice(2)}`;
    return cache;
  }
}

/** En-têtes communs à toutes les requêtes de jeu. */
export function entetesJeu(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-appareil": identifiantAppareil(),
  };
}
