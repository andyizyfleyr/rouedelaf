import "server-only";

import { sql } from "@/lib/db";

/**
 * Lecture des réglages de la table `parametres` (avec valeurs par défaut).
 * Une seule requête par rendu : on charge tout d'un coup et on met en cache
 * 30 secondes en mémoire du processus serveur.
 */

export type Parametres = {
  toursMax: number;
  dureeValiditeCodeJours: number;
  dureeSessionMinutes: number;
  activeJeu: boolean;
  messagePerdu: string;
  reductionConsolation: number;
  otpTentativesMax: number;
  otpValiditeMinutes: number;
  toursBonusParrainage: number;
};

const DEFAUTS: Parametres = {
  toursMax: 1,
  dureeValiditeCodeJours: 14,
  dureeSessionMinutes: 120,
  activeJeu: true,
  messagePerdu:
    "Pas de chance cette fois ! Voici un bon de réduction pour votre prochaine visite.",
  reductionConsolation: 10,
  otpTentativesMax: 5,
  otpValiditeMinutes: 10,
  toursBonusParrainage: 1,
};

/**
 * Lecture des réglages à chaque requête.
 *
 * Pas de cache mémoire maison : en serverless, le processus est éphémère et
 * un cache local ne sert à rien ; de plus, Cache Components interdit les
 * valeurs instables (`Date.now()`) pendant le prérendu. La requête est une
 * simple SELECT sur une table de 9 lignes : coût négligeable, toujours à jour.
 */
export async function lireParametres(): Promise<Parametres> {
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
      toursMax: nombre("tours_max", DEFAUTS.toursMax),
      dureeValiditeCodeJours: nombre(
        "duree_validite_code_jours",
        DEFAUTS.dureeValiditeCodeJours,
      ),
      dureeSessionMinutes: nombre("duree_session_minutes", DEFAUTS.dureeSessionMinutes),
      activeJeu: booleen("active_jeu", DEFAUTS.activeJeu),
      messagePerdu: map.get("message_perdu") ?? DEFAUTS.messagePerdu,
      reductionConsolation: nombre("reduction_consolation", DEFAUTS.reductionConsolation),
      otpTentativesMax: nombre("otp_tentatives_max", DEFAUTS.otpTentativesMax),
      otpValiditeMinutes: nombre("otp_validite_minutes", DEFAUTS.otpValiditeMinutes),
      toursBonusParrainage: nombre("tours_bonus_parrainage", DEFAUTS.toursBonusParrainage),
    };

    return valeur;
  } catch (e) {
    console.error("[params] lecture impossible, valeurs par défaut", e);
    return DEFAUTS;
  }
}

/** Écrit un paramètre (admin). */
export async function ecrireParametre(cle: string, valeur: string): Promise<void> {
  await sql`
    INSERT INTO parametres (cle, valeur)
    VALUES (${cle}, ${valeur})
    ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, updated_at = now()
  `;
}
