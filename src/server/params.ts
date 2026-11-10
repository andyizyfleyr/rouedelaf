import "server-only";

import { cache } from "react";

import { sql } from "@/lib/db";

/**
 * Lecture des réglages de la table `parametres` (avec valeurs par défaut).
 * Une seule requête par rendu : on charge tout d'un coup et on met en cache
 * 30 secondes en mémoire du processus serveur.
 */

export type Parametres = {
  dureeValiditeCodeJours: number;
  activeJeu: boolean;
  messagePerdu: string;
  reductionConsolation: number;
};

/**
 * Réglages par défaut.
 *
 * `tours_max`, `tours_bonus_parrainage` et `duree_session_minutes` ont
 * disparu avec l'inscription : sur le poste de la boutique, il n'y a ni compte
 * ni limite de tours. Les lignes correspondantes restent en base (elles ne
 * gênent personne) mais ne sont plus lues.
 */
const DEFAUTS: Parametres = {
  dureeValiditeCodeJours: 14,
  activeJeu: true,
  messagePerdu:
    "Pas de chance cette fois ! Voici un bon de réduction pour votre prochaine visite.",
  reductionConsolation: 10,
};

/**
 * Mémoïsation PAR REQUÊTE (`React.cache`), et non `use cache`.
 *
 * L'accueil admin appelle `lireParametres()` plusieurs fois : la clé est donc
 * mémorisée pour le rendu en cours, ce qui évite les lectures SQL en double —
 * c'est le seul gain recherché.
 *
 * ⚠️ Ne PAS passer en `"use cache"` : cette fonction est appelée depuis les
 * pages client et admin, qui sont prérendues au build. Un cache persistant
 * exécuterait la requête SQL pendant le build Vercel, ce qui fait échouer le
 * déploiement (« A "use cache" function took too long during prerendering »).
 * Les réglages changent rarement et coûtent une requête : inutile de risquer ça.
 */
export const lireParametres: () => Promise<Parametres> = cache(async (): Promise<Parametres> => {
  try {
    const lignes = await sql`SELECT cle, valeur FROM parametres`;
    const map = new Map(lignes.map((l) => [String(l.cle), String(l.valeur)]));

    const nombre = (cle: string, defaut: number) => {
      const brut = map.get(cle);
      const n = brut === undefined ? NaN : Number.parseInt(brut, 10);
      return Number.isFinite(n) ? n : defaut;
    };
    const booleen = (cle: string, defaut: boolean) => {
      const brut = map.get(cle);
      if (brut === undefined) return defaut;
      return brut === "true" || brut === "1";
    };

    const valeur: Parametres = {
      dureeValiditeCodeJours: nombre(
        "duree_validite_code_jours",
        DEFAUTS.dureeValiditeCodeJours,
      ),
      activeJeu: booleen("active_jeu", DEFAUTS.activeJeu),
      messagePerdu: map.get("message_perdu") ?? DEFAUTS.messagePerdu,
      reductionConsolation: nombre("reduction_consolation", DEFAUTS.reductionConsolation),
    };

    return valeur;
  } catch (e) {
    console.error("[params] lecture impossible, valeurs par défaut", e);
    return DEFAUTS;
  }
});

/** Écrit un paramètre (admin). */
export async function ecrireParametre(cle: string, valeur: string): Promise<void> {
  await sql`
    INSERT INTO parametres (cle, valeur)
    VALUES (${cle}, ${valeur})
    ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, updated_at = now()
  `;
}
