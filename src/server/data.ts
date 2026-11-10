import "server-only";

import { sql } from "@/lib/db";
import type {
  Cadeau,
  FluxBorne,
  GagnantEcran,
  StatsDashboard,
  TirageResultat,
} from "@/lib/types";

/**
 * Requêtes de lecture & d'écriture (cadeaux, tirages, statistiques).
 * Toutes les requêtes sont paramétrées : aucune concaténation SQL.
 *
 * Depuis que le jeu tourne sur le poste de la boutique, il n'y a plus de
 * participants à gérer côté application : les tirages sont anonymes. La table
 * `participants` reste en base pour l'historique des anciennes éditions.
 */

/* -------------------------------------------------------------------------- */
/*  TIRAGES                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Retrouve un tirage par son code de retrait (scan en caisse).
 *
 * ⚠️ Anciennement en `JOIN participants` : un tirage anonyme (poste de la
 * boutique) n'a pas de participant, et le JOIN le faisait disparaître — la
 * vendeuse lisait « code introuvable » sur un code parfaitement valable. Le
 * LEFT JOIN garde la compatibilité avec l'historique.
 */
export async function tirageParCode(code: string): Promise<
  | (TirageResultat & {
      participant_id: number | null;
      participant_nom: string | null;
      telephone_aff: string | null;
    })
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
    LEFT JOIN participants p ON p.id = t.participant_id
    LEFT JOIN cadeaux c ON c.id = t.cadeau_id
    WHERE upper(t.code_unique) = upper(${code})
    LIMIT 1
  `;
  return ligne as never;
}

/** Valide la remise d'un cadeau (scan vendeuse). */
export async function marquerRecupere(code: string): Promise<
  | { ok: true; cadeauNom: string; participantNom: string | null }
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

/**
 * Derniers cadeaux gagnés.
 *
 * Depuis que le jeu tourne sur le poste de la boutique, un tirage n'est plus
 * rattaché à un client : il n'y a plus de nom à afficher. On expose donc le
 * LOT (nom + couleur) et l'heure, ce qui suffit à animer l'écran boutique et
 * le tableau de bord — et évite d'afficher une colonne vide.
 */
export async function listerGagnantsRecents(limite = 25): Promise<GagnantEcran[]> {
  const lignes = await sql`
    SELECT
      t.id,
      c.nom AS cadeau_nom,
      c.couleur,
      c.icone,
      c.image_url,
      t.created_at
    FROM tirages t
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
        c.nom AS cadeau_nom,
        c.couleur,
        c.icone,
        c.image_url,
        t.created_at
      FROM tirages t
      LEFT JOIN cadeaux c ON c.id = t.cadeau_id
      WHERE t.statut = 'gagne'
      ORDER BY t.created_at DESC
      LIMIT ${limite}
    `,
    sql`
      SELECT
        (SELECT count(*)::int FROM tirages) AS tirages,
        (SELECT count(*)::int FROM tirages WHERE statut = 'gagne') AS gagnes
    `,
  ]);

  return {
    gagnants: (gagnants as FluxBorne["gagnants"]).map((g) => ({ ...g, id: Number(g.id) })),
    totaux: {
      tirages: Number((totaux as { tirages: number }[])[0]?.tirages ?? 0),
      gagnes: Number((totaux as { gagnes: number }[])[0]?.gagnes ?? 0),
    },
  };
}

export async function statistiques(): Promise<StatsDashboard> {
  const [totaux] = await sql`
    SELECT
      (SELECT count(*)::int FROM tirages) AS tirages_total,
      (SELECT count(*)::int FROM tirages
        WHERE created_at::date = (now() AT TIME ZONE 'Africa/Porto-Novo')::date) AS tirages_aujourdhui,
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
      tirages, gagnes, recuperes
    FROM (
      SELECT
        d.jour,
        (SELECT count(*)::int FROM tirages t
          WHERE (t.created_at AT TIME ZONE 'Africa/Porto-Novo')::date = d.jour) AS tirages,
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


  const parCadeau = await sql`
    SELECT
      c.id, c.nom, c.couleur, c.stock,
      (SELECT count(*)::int FROM tirages t WHERE t.cadeau_id = c.id AND t.statut = 'gagne') AS gagnes,
      (SELECT count(*)::int FROM tirages t WHERE t.cadeau_id = c.id AND t.recupere) AS recuperes
    FROM cadeaux c
    ORDER BY c.ordre ASC, c.id ASC
  `;

  const gagnesTotal = Number(totaux?.gagnes_total ?? 0);
  const tiragesTotal = Number(totaux?.tirages_total ?? 0);

  return {
    tiragesAujourdhui: Number(totaux?.tirages_aujourdhui ?? 0),
    tiragesTotal,
    gagnesTotal,
    recuperesTotal: Number(totaux?.recuperes_total ?? 0),
    enAttenteTotal: Number(totaux?.en_attente_total ?? 0),
    codesExpires: Number(totaux?.codes_expires ?? 0),
    tauxVictoire: tiragesTotal > 0 ? Math.round((gagnesTotal / tiragesTotal) * 1000) / 10 : 0,
    parJour: (parJour as { jour: string; tirages: number; gagnes: number; recuperes: number }[]).map(
      (l) => ({
        jour: String(l.jour),
        tirages: Number(l.tirages),
        gagnes: Number(l.gagnes),
        recuperes: Number(l.recuperes),
      }),
    ),
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


export async function journaliser(action: string, details: Record<string, unknown>): Promise<void> {
  try {
    await sql`INSERT INTO journal_admin (action, details) VALUES (${action}, ${JSON.stringify(details)}::jsonb)`;
  } catch (e) {
    console.error("[audit]", e);
  }
}
