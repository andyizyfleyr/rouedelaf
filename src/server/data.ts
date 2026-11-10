import "server-only";

import { sql } from "@/lib/db";
import type {
  Cadeau,
  FluxBorne,
  GagnantEcran,
  LigneJoueur,
  StatsDashboard,
  TirageResultat,
} from "@/lib/types";

/**
 * Requêtes de lecture & d'écriture (participants, cadeaux, tirages).
 * Toutes les requêtes sont paramétrées : aucune concaténation SQL.
 */

/* -------------------------------------------------------------------------- */
/*  PARTICIPANTS                                                               */
/* -------------------------------------------------------------------------- */

export type Participant = {
  id: number;
  nom: string;
  telephone: string;
  telephone_aff: string | null;
  source: string;
  tours_bonus: number;
  bloque: boolean;
  consentement: boolean;
  created_at: string;
  code_parrain: string | null;
};

export async function participantParTelephone(telephone: string): Promise<Participant | null> {
  const [ligne] = await sql`
    SELECT id, nom, telephone, telephone_aff, source, tours_bonus, bloque, consentement, created_at, code_parrain
    FROM participants WHERE telephone = ${telephone} LIMIT 1
  `;
  return (ligne as Participant) ?? null;
}

export async function participantParId(id: number): Promise<Participant | null> {
  const [ligne] = await sql`
    SELECT id, nom, telephone, telephone_aff, source, tours_bonus, bloque, consentement, created_at, code_parrain
    FROM participants WHERE id = ${id} LIMIT 1
  `;
  return (ligne as Participant) ?? null;
}

/** Code de parrainage public d'un participant (tiré au sort à l'inscription). */
export async function codeParrainDe(participantId: number): Promise<string | null> {
  const [ligne] = await sql`
    SELECT code_parrain FROM participants WHERE id = ${participantId} LIMIT 1
  `;
  const code = (ligne as { code_parrain?: string | null } | undefined)?.code_parrain;
  return code ?? null;
}

/** Retrouve un participant à partir d'un code de parrainage (index unique). */
export async function participantParCodeParrain(code: string): Promise<Participant | null> {
  const propre = code.trim().toUpperCase();
  if (!/^R[0-9A-Z]{5,9}$/.test(propre)) return null;
  const [ligne] = await sql`
    SELECT id, nom, telephone, telephone_aff, source, tours_bonus, bloque, consentement, created_at, code_parrain
    FROM participants WHERE code_parrain = ${propre} LIMIT 1
  `;
  return (ligne as Participant) ?? null;
}

/**
 * Crédite un tour bonus au parrain quand son filleul s'inscrit.
 * - `parrainages.filleul_id` est UNIQUE : un filleul ne crédite qu'une fois.
 * - Le bonus est ajouté à `participants.tours_bonus` du parrain.
 * - Retourne true si un nouveau parrainage a effectivement été enregistré.
 */
export async function crediterParrainage(
  codeParrain: string,
  filleulId: number,
  bonus: number,
): Promise<boolean> {
  const parrain = await participantParCodeParrain(codeParrain);
  if (!parrain || parrain.id === filleulId) return false;

  if (!parrain.code_parrain) return false;

  const [insere] = await sql`
    INSERT INTO parrainages (parrain_id, filleul_id, code_parrain)
    VALUES (${parrain.id}, ${filleulId}, ${parrain.code_parrain})
    ON CONFLICT (filleul_id) DO NOTHING
    RETURNING id
  `;
  if (!insere) return false;

  await sql`
    UPDATE participants SET tours_bonus = tours_bonus + ${bonus}
    WHERE id = ${parrain.id}
  `;
  return true;
}

/** Enregistre un nouveau participant (ou renvoie l'existant). */
export async function creerParticipant(input: {
  nom: string;
  telephone: string;
  telephoneAff: string;
  source: string;
  appareil: string | null;
  ipHash: string | null;
  consentement: boolean;
  /** Code de parrainage unique, généré par l'appelant. */
  codeParrain: string;
}): Promise<{ participant: Participant; nouveau: boolean }> {
  const [insere] = await sql`
    INSERT INTO participants (nom, telephone, telephone_aff, source, appareil, ip_hash, derniere_ip_hash, consentement, code_parrain)
    VALUES (
      ${input.nom}, ${input.telephone}, ${input.telephoneAff}, ${input.source},
      ${input.appareil}, ${input.ipHash}, ${input.ipHash}, ${input.consentement}, ${input.codeParrain}
    )
    ON CONFLICT (telephone) DO NOTHING
    RETURNING id, nom, telephone, telephone_aff, source, tours_bonus, bloque, consentement, created_at, code_parrain
  `;

  if (insere) {
    return { participant: insere as Participant, nouveau: true };
  }

  const existant = await participantParTelephone(input.telephone);
  if (!existant) throw new Error("Participant introuvable après insertion");
  return { participant: existant, nouveau: false };
}

/* -------------------------------------------------------------------------- */
/*  OTP                                                                        */
/* -------------------------------------------------------------------------- */

export async function enregistrerOtp(input: {
  telephone: string;
  codeHash: string;
  expireLe: Date;
}): Promise<void> {
  // On invalide les anciens codes non utilisés pour ce numéro.
  await sql`
    UPDATE otp_codes SET utilise = true
    WHERE telephone = ${input.telephone} AND utilise = false
  `;
  await sql`
    INSERT INTO otp_codes (telephone, code_hash, expire_le)
    VALUES (${input.telephone}, ${input.codeHash}, ${input.expireLe.toISOString()})
  `;
}

export type OtpActif = {
  id: number;
  code_hash: string;
  tentatives: number;
  expire_le: string;
};

export async function otpActif(telephone: string): Promise<OtpActif | null> {
  const [ligne] = await sql`
    SELECT id, code_hash, tentatives, expire_le
    FROM otp_codes
    WHERE telephone = ${telephone} AND utilise = false
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return (ligne as OtpActif) ?? null;
}

export async function incrementerTentativesOtp(id: number): Promise<number> {
  const [ligne] = await sql`
    UPDATE otp_codes SET tentatives = tentatives + 1
    WHERE id = ${id}
    RETURNING tentatives
  `;
  return Number(ligne?.tentatives ?? 0);
}

export async function consommerOtp(id: number): Promise<void> {
  await sql`UPDATE otp_codes SET utilise = true WHERE id = ${id}`;
}

/* -------------------------------------------------------------------------- */
/*  SESSIONS DE JEU                                                            */
/* -------------------------------------------------------------------------- */

export async function creerSessionEnBase(input: {
  participantId: number;
  tokenHash: string;
  expireLe: Date;
}): Promise<void> {
  await sql`
    INSERT INTO sessions_jeu (participant_id, token_hash, expire_le)
    VALUES (${input.participantId}, ${input.tokenHash}, ${input.expireLe.toISOString()})
  `;
}

export async function sessionValide(tokenHash: string): Promise<boolean> {
  const [ligne] = await sql`
    SELECT 1 FROM sessions_jeu
    WHERE token_hash = ${tokenHash} AND expire_le > now()
    LIMIT 1
  `;
  return Boolean(ligne);
}

/* -------------------------------------------------------------------------- */
/*  TIRAGES                                                                    */
/* -------------------------------------------------------------------------- */

export async function tirageParId(id: number): Promise<TirageResultat | null> {
  const [ligne] = await sql`
    SELECT
      t.id, t.statut, t.code_unique, t.recupere, t.expire_le, t.created_at,
      c.nom AS cadeau_nom, c.couleur AS cadeau_couleur, c.icone AS cadeau_icone,
      c.description AS cadeau_description, c.image_url AS cadeau_image_url,
      (SELECT NULLIF(valeur, '')::int FROM parametres WHERE cle = 'reduction_consolation') AS reduction_consolation
    FROM tirages t
    LEFT JOIN cadeaux c ON c.id = t.cadeau_id
    WHERE t.id = ${id}
  `;
  return (ligne as TirageResultat) ?? null;
}

/** Dernier tirage d'un participant (pour la page /resultat). */
export async function dernierTirageParticipant(
  participantId: number,
): Promise<TirageResultat | null> {
  const [ligne] = await sql`
    SELECT
      t.id, t.statut, t.code_unique, t.recupere, t.expire_le, t.created_at,
      c.nom AS cadeau_nom, c.couleur AS cadeau_couleur, c.icone AS cadeau_icone,
      c.description AS cadeau_description, c.image_url AS cadeau_image_url,
      (SELECT NULLIF(valeur, '')::int FROM parametres WHERE cle = 'reduction_consolation') AS reduction_consolation
    FROM tirages t
    LEFT JOIN cadeaux c ON c.id = t.cadeau_id
    WHERE t.participant_id = ${participantId}
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT 1
  `;
  return (ligne as TirageResultat) ?? null;
}

export async function tirageParCode(code: string): Promise<
  | (TirageResultat & { participant_id: number; participant_nom: string; telephone_aff: string | null })
  | null
> {
  const [ligne] = await sql`
    SELECT
      t.id, t.statut, t.code_unique, t.recupere, t.expire_le, t.created_at,
      t.participant_id,
      p.nom AS participant_nom, p.telephone_aff,
      c.nom AS cadeau_nom, c.couleur AS cadeau_couleur, c.icone AS cadeau_icone,
      c.description AS cadeau_description, c.image_url AS cadeau_image_url
    FROM tirages t
    JOIN participants p ON p.id = t.participant_id
    LEFT JOIN cadeaux c ON c.id = t.cadeau_id
    WHERE upper(t.code_unique) = upper(${code})
    LIMIT 1
  `;
  return ligne as never;
}

/** Valide la remise d'un cadeau (scan vendeuse). */
export async function marquerRecupere(code: string): Promise<
  | { ok: true; cadeauNom: string; participantNom: string }
  | { ok: false; raison: "introuvable" | "deja" | "expire" | "perdu" }
> {
  const tirage = await tirageParCode(code);
  if (!tirage) return { ok: false, raison: "introuvable" };
  if (tirage.statut !== "gagne") return { ok: false, raison: "perdu" };
  if (tirage.recupere) return { ok: false, raison: "deja" };
  if (new Date(tirage.expire_le).getTime() < Date.now()) return { ok: false, raison: "expire" };

  const [ligne] = await sql`
    UPDATE tirages SET recupere = true, recupere_le = now()
    WHERE id = ${tirage.id} AND recupere = false
    RETURNING id
  `;
  if (!ligne) return { ok: false, raison: "deja" };

  await sql`
    INSERT INTO journal_admin (action, details)
    VALUES ('remise_cadeau', ${JSON.stringify({ tirageId: tirage.id, code })}::jsonb)
  `;

  return {
    ok: true,
    cadeauNom: tirage.cadeau_nom ?? "Cadeau",
    participantNom: tirage.participant_nom,
  };
}

/* -------------------------------------------------------------------------- */
/*  CADEAUX                                                                    */
/* -------------------------------------------------------------------------- */

export async function listerCadeauxAdmin(): Promise<Cadeau[]> {
  const lignes = await sql`
    SELECT
      c.id, c.nom, c.description, c.image_url, c.stock, c.probabilite, c.couleur,
      c.icone, c.actif, c.ordre, c.created_at, c.updated_at,
      (SELECT count(*)::int FROM tirages t
        WHERE t.cadeau_id = c.id AND t.statut = 'gagne' AND t.recupere = false) AS gagnes_non_recuperes
    FROM cadeaux c
    ORDER BY c.ordre ASC, c.id ASC
  `;
  return (lignes as Cadeau[]).map((c) => ({
    ...c,
    id: Number(c.id),
    stock: Number(c.stock),
    probabilite: Number(c.probabilite),
    ordre: Number(c.ordre),
  }));
}

export async function creerCadeau(input: {
  nom: string;
  description: string | null;
  imageUrl: string | null;
  stock: number;
  probabilite: number;
  couleur: string;
  icone: string;
  ordre: number;
  actif: boolean;
}): Promise<void> {
  await sql`
    INSERT INTO cadeaux (nom, description, image_url, stock, probabilite, couleur, icone, ordre, actif)
    VALUES (
      ${input.nom}, ${input.description}, ${input.imageUrl}, ${input.stock},
      ${input.probabilite}, ${input.couleur}, ${input.icone}, ${input.ordre}, ${input.actif}
    )
  `;
}

export async function modifierCadeau(
  id: number,
  input: {
    nom: string;
    description: string | null;
    imageUrl: string | null;
    stock: number;
    probabilite: number;
    couleur: string;
    icone: string;
    ordre: number;
    actif: boolean;
  },
): Promise<void> {
  await sql`
    UPDATE cadeaux SET
      nom = ${input.nom}, description = ${input.description}, image_url = ${input.imageUrl},
      stock = ${input.stock}, probabilite = ${input.probabilite}, couleur = ${input.couleur},
      icone = ${input.icone}, ordre = ${input.ordre}, actif = ${input.actif}
    WHERE id = ${id}
  `;
}

export async function supprimerCadeau(id: number): Promise<{ ok: boolean; raison?: string }> {
  const [utilise] = await sql`SELECT 1 FROM tirages WHERE cadeau_id = ${id} LIMIT 1`;
  if (utilise) {
    return {
      ok: false,
      raison: "Ce cadeau a déjà été gagné : désactivez-le plutôt que de le supprimer.",
    };
  }
  await sql`DELETE FROM cadeaux WHERE id = ${id}`;
  return { ok: true };
}

export async function basculerActifCadeau(id: number, actif: boolean): Promise<void> {
  await sql`UPDATE cadeaux SET actif = ${actif} WHERE id = ${id}`;
}

/** Ajuste le stock (+/-) de façon atomique. */
export async function ajusterStock(id: number, delta: number): Promise<number> {
  const [ligne] = await sql`
    UPDATE cadeaux SET stock = GREATEST(stock + ${delta}, 0) WHERE id = ${id}
    RETURNING stock
  `;
  return Number(ligne?.stock ?? 0);
}

/* -------------------------------------------------------------------------- */
/*  ADMIN — statistiques, joueurs, écran                                       */
/* -------------------------------------------------------------------------- */

export async function listerGagnantsRecents(limite = 25): Promise<GagnantEcran[]> {
  const lignes = await sql`
    SELECT t.id, p.nom, p.telephone_aff, c.nom AS cadeau_nom, c.couleur, t.created_at
    FROM tirages t
    JOIN participants p ON p.id = t.participant_id
    LEFT JOIN cadeaux c ON c.id = t.cadeau_id
    WHERE t.statut = 'gagne'
    ORDER BY t.created_at DESC
    LIMIT ${limite}
  `;
  return (lignes as GagnantEcran[]).map((g) => ({ ...g, id: Number(g.id) }));
}

/**
 * Flux public de la borne : prénoms + initiale uniquement, jamais le numéro
 * ni le code cadeau. Sert à la fois à /borne (rendu serveur) et à
 * /api/borne (rafraîchissement toutes les 15 s).
 */
export async function fluxBorne(limite = 10): Promise<FluxBorne> {
  const [gagnants, totaux] = await Promise.all([
    sql`
      SELECT
        t.id,
        CASE
          WHEN position(' ' in p.nom) > 0
            THEN split_part(p.nom, ' ', 1) || ' ' || upper(left(split_part(p.nom, ' ', 2), 1)) || '.'
          ELSE p.nom
        END AS nom,
        c.nom AS cadeau_nom,
        c.couleur,
        t.created_at
      FROM tirages t
      JOIN participants p ON p.id = t.participant_id
      LEFT JOIN cadeaux c ON c.id = t.cadeau_id
      WHERE t.statut = 'gagne'
      ORDER BY t.created_at DESC
      LIMIT ${limite}
    `,
    sql`
      SELECT
        (SELECT count(*)::int FROM participants) AS joueurs,
        (SELECT count(*)::int FROM tirages WHERE statut = 'gagne') AS gagnes
    `,
  ]);

  return {
    gagnants: (gagnants as FluxBorne["gagnants"]).map((g) => ({ ...g, id: Number(g.id) })),
    totaux: {
      joueurs: Number((totaux as { joueurs: number }[])[0]?.joueurs ?? 0),
      gagnes: Number((totaux as { gagnes: number }[])[0]?.gagnes ?? 0),
    },
  };
}

export async function statistiques(): Promise<StatsDashboard> {
  const [totaux] = await sql`
    SELECT
      (SELECT count(*)::int FROM participants) AS joueurs_total,
      (SELECT count(*)::int FROM participants
        WHERE created_at::date = (now() AT TIME ZONE 'Africa/Porto-Novo')::date) AS joueurs_aujourdhui,
      (SELECT count(*)::int FROM tirages) AS tirages_total,
      (SELECT count(*)::int FROM tirages WHERE statut = 'gagne') AS gagnes_total,
      (SELECT count(*)::int FROM tirages WHERE statut = 'gagne' AND recupere) AS recuperes_total,
      (SELECT count(*)::int FROM tirages
        WHERE statut = 'gagne' AND NOT recupere AND expire_le > now()) AS en_attente_total,
      (SELECT count(*)::int FROM tirages
        WHERE statut = 'gagne' AND NOT recupere AND expire_le <= now()) AS codes_expires
  `;

  const parJour = await sql`
    SELECT
      to_char(jour, 'YYYY-MM-DD') AS jour,
      joueurs, gagnes, recuperes
    FROM (
      SELECT
        d.jour,
        (SELECT count(*)::int FROM participants p
          WHERE (p.created_at AT TIME ZONE 'Africa/Porto-Novo')::date = d.jour) AS joueurs,
        (SELECT count(*)::int FROM tirages t
          WHERE t.statut = 'gagne'
            AND (t.created_at AT TIME ZONE 'Africa/Porto-Novo')::date = d.jour) AS gagnes,
        (SELECT count(*)::int FROM tirages t
          WHERE t.recupere
            AND (t.created_at AT TIME ZONE 'Africa/Porto-Novo')::date = d.jour) AS recuperes
      FROM (
        SELECT generate_series(
          (now() AT TIME ZONE 'Africa/Porto-Novo')::date - interval '13 days',
          (now() AT TIME ZONE 'Africa/Porto-Novo')::date,
          interval '1 day'
        )::date AS jour
      ) d
    ) s
    ORDER BY jour ASC
  `;

  const parSource = await sql`
    SELECT COALESCE(NULLIF(source, ''), 'direct') AS source, count(*)::int AS joueurs
    FROM participants
    GROUP BY 1
    ORDER BY joueurs DESC
    LIMIT 8
  `;

  const parCadeau = await sql`
    SELECT
      c.id, c.nom, c.couleur, c.stock,
      (SELECT count(*)::int FROM tirages t WHERE t.cadeau_id = c.id AND t.statut = 'gagne') AS gagnes,
      (SELECT count(*)::int FROM tirages t WHERE t.cadeau_id = c.id AND t.recupere) AS recuperes
    FROM cadeaux c
    ORDER BY c.ordre ASC, c.id ASC
  `;

  const joueursTotal = Number(totaux?.joueurs_total ?? 0);
  const gagnesTotal = Number(totaux?.gagnes_total ?? 0);
  const tiragesTotal = Number(totaux?.tirages_total ?? 0);

  return {
    joueursTotal,
    joueursAujourdhui: Number(totaux?.joueurs_aujourdhui ?? 0),
    tiragesTotal,
    gagnesTotal,
    recuperesTotal: Number(totaux?.recuperes_total ?? 0),
    enAttenteTotal: Number(totaux?.en_attente_total ?? 0),
    codesExpires: Number(totaux?.codes_expires ?? 0),
    tauxVictoire: tiragesTotal > 0 ? Math.round((gagnesTotal / tiragesTotal) * 1000) / 10 : 0,
    parJour: (parJour as { jour: string; joueurs: number; gagnes: number; recuperes: number }[]).map(
      (l) => ({
        jour: String(l.jour),
        joueurs: Number(l.joueurs),
        gagnes: Number(l.gagnes),
        recuperes: Number(l.recuperes),
      }),
    ),
    parSource: (parSource as { source: string; joueurs: number }[]).map((l) => ({
      source: String(l.source),
      joueurs: Number(l.joueurs),
    })),
    parCadeau: (parCadeau as {
      id: number;
      nom: string;
      couleur: string;
      stock: number;
      gagnes: number;
      recuperes: number;
    }[]).map((l) => ({
      id: Number(l.id),
      nom: l.nom,
      couleur: l.couleur,
      stock: Number(l.stock),
      gagnes: Number(l.gagnes),
      recuperes: Number(l.recuperes),
    })),
  };
}

export async function listerJoueurs(filtres: {
  recherche?: string;
  source?: string;
  limite?: number;
  page?: number;
}): Promise<{ joueurs: LigneJoueur[]; total: number }> {
  const limite = Math.min(Math.max(filtres.limite ?? 100, 1), 5000);
  const decalage = Math.max((filtres.page ?? 1) - 1, 0) * limite;
  const recherche = filtres.recherche?.trim() ? `%${filtres.recherche.trim()}%` : null;
  const source = filtres.source && filtres.source !== "tous" ? filtres.source : null;

  const joueurs = await sql`
    SELECT
      p.id, p.nom, p.telephone, p.telephone_aff, p.source, p.created_at,
      p.consentement, p.bloque,
      c.nom AS cadeau_nom,
      t.statut, t.code_unique, t.recupere, t.created_at AS tirage_le
    FROM participants p
    LEFT JOIN LATERAL (
      SELECT * FROM tirages t2
      WHERE t2.participant_id = p.id
      ORDER BY t2.created_at DESC, t2.id DESC
      LIMIT 1
    ) t ON true
    LEFT JOIN cadeaux c ON c.id = t.cadeau_id
    WHERE (${recherche}::text IS NULL OR p.nom ILIKE ${recherche} OR p.telephone ILIKE ${recherche})
      AND (${source}::text IS NULL OR p.source = ${source})
    ORDER BY p.created_at DESC
    LIMIT ${limite} OFFSET ${decalage}
  `;

  const [compte] = await sql`
    SELECT count(*)::int AS total FROM participants p
    WHERE (${recherche}::text IS NULL OR p.nom ILIKE ${recherche} OR p.telephone ILIKE ${recherche})
      AND (${source}::text IS NULL OR p.source = ${source})
  `;

  return {
    joueurs: (joueurs as LigneJoueur[]).map((j) => ({ ...j, id: Number(j.id) })),
    total: Number(compte?.total ?? 0),
  };
}

/** Tous les numéros pour une campagne WhatsApp (export). */
export async function numerosPourExport(): Promise<
  { nom: string; telephone: string; telephone_aff: string; source: string; created_at: string }[]
> {
  const lignes = await sql`
    SELECT nom, telephone, COALESCE(telephone_aff, telephone) AS telephone_aff, source, created_at
    FROM participants
    WHERE bloque = false
    ORDER BY created_at DESC
  `;
  return lignes as never;
}

export async function journaliser(action: string, details: Record<string, unknown>): Promise<void> {
  try {
    await sql`INSERT INTO journal_admin (action, details) VALUES (${action}, ${JSON.stringify(details)}::jsonb)`;
  } catch (e) {
    console.error("[audit]", e);
  }
}
