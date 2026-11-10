import "server-only";

import { cache } from "react";

import { lireParametres } from "@/server/params";

/**
 * Identité de la boutique : nom et adresse réglables depuis l'admin.
 *
 * Le nom n'est plus figé dans les variables d'environnement (il fallait
 * redéployer pour le corriger) : il vit dans la table `parametres` et
 * NEXT_PUBLIC_BOUTIQUE_NOM ne sert plus que de valeur de secours.
 */
export type Identite = { nom: string; adresse: string };

export const lireIdentite: () => Promise<Identite> = cache(
  async (): Promise<Identite> => {
    const p = await lireParametres();
    return { nom: p.boutiqueNom, adresse: p.boutiqueAdresse };
  },
);
