import { randomInt } from "node:crypto";

/**
 * Sélection cryptographique du lot gagnant.
 *
 * Ce module est volontairement SÉPARÉ du reste du code serveur (pas d'accès
 * base, pas de "server-only") : il peut ainsi être testé unitairement et
 * audité facilement. Il n'est importé QUE par les modules serveur.
 */

export { randomInt };

/**
 * Sélection du lot gagnant avec `crypto.randomInt`.
 * Renvoie null si le tirage est perdant.
 *
 * Les poids sont renormalisés sur les lots disponibles. La part manquante
 * jusqu'à 100 représente les cases « perdues ».
 */
export function tirerGagnant(
  disponibles: { id: number; probabilite: number }[],
): { id: number } | null {
  if (disponibles.length === 0) return null;

  const total = disponibles.reduce((s, c) => s + Math.max(c.probabilite, 0), 0);
  if (total <= 0) return null;

  // On raisonne en centièmes de pourcent pour rester en entiers.
  const totalCent = Math.round(total * 100);
  const chancePerdre = Math.max(100 * 100 - totalCent, 0);
  const borne = totalCent + chancePerdre;

  const point = randomInt(borne);

  let curseur = 0;
  for (const cadeau of disponibles) {
    curseur += Math.round(Math.max(cadeau.probabilite, 0) * 100);
    if (point < curseur) return { id: cadeau.id };
  }
  return null; // case perdante
}

