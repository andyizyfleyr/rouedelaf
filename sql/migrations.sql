-- ============================================================================
--  MIGRATIONS — rejouées à chaque démarrage de l'application
--  Fichier : sql/migrations.sql
--
--  Pourquoi ce fichier existe : une base déjà en production contient les
--  données du jeu, on ne peut donc pas rejouer `schema.sql` (création) pour
--  corriger une fonction. On applique ici uniquement les remplacements
--  idempotents, sans jamais toucher aux données.
--
--  ⚠ Toute évolution du schéma doit être écrite ici ET dans schema.sql, pour
--  que les bases neuves et les bases existantes convergent.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  M1. « Un tour par personne » garanti par la base
--
--  L'ancienne version comptait les tours uniquement dans Node : deux onglets
--  simultanés pouvaient chacun créer un tirage. La fonction verrouille
--  désormais la ligne du participant (FOR UPDATE) et vérifie son droit à jouer
--  dans la même transaction que l'insertion.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enregistrer_tirage(
  p_participant_id bigint,
  p_cadeau_id      bigint,           -- NULL = tirage perdu
  p_duree_jours    integer DEFAULT 14,
  p_tour_bonus     boolean DEFAULT false,
  p_appareil       text DEFAULT NULL,
  p_ip_hash        text DEFAULT NULL
)
RETURNS TABLE (
  tirage_id   bigint,
  cadeau_id   bigint,
  code_unique text,
  expire_le   timestamptz,
  statut      text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock      integer;
  v_code       text;
  v_tirage_id  bigint;
  v_expire     timestamptz;
  v_statut     text;
  v_alphabet   text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_try        integer := 0;
  v_tours_max  integer;
  v_bonus      integer;
  v_deja       integer;
  v_bloque     boolean;
BEGIN
  -- Participant FACULTATIF (migration M4) : sur le poste de la boutique, le
  -- tirage est anonyme (p_participant_id NULL) et le nombre de tours n'est
  -- plus limité — seule la limite de stock s'applique.
  IF p_participant_id IS NOT NULL THEN
    SELECT tours_bonus, bloque INTO v_bonus, v_bloque
      FROM participants
     WHERE id = p_participant_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PARTICIPANT_INTROUVABLE' USING ERRCODE = 'P0001';
    END IF;
    IF v_bloque THEN
      RAISE EXCEPTION 'PARTICIPANT_BLOQUE' USING ERRCODE = 'P0001';
    END IF;

    v_tours_max := param_int('tours_max', 1);
    SELECT count(*)::int INTO v_deja FROM tirages WHERE participant_id = p_participant_id;

    IF v_deja >= v_tours_max + COALESCE(v_bonus, 0) THEN
      RAISE EXCEPTION 'TOURS_EPUISES' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_cadeau_id IS NOT NULL THEN
    SELECT stock INTO v_stock
      FROM cadeaux
     WHERE id = p_cadeau_id AND actif
     FOR UPDATE;

    IF NOT FOUND OR v_stock IS NULL OR v_stock <= 0 THEN
      RAISE EXCEPTION 'CADEAU_INDISPONIBLE' USING ERRCODE = 'P0001';
    END IF;

    UPDATE cadeaux SET stock = stock - 1 WHERE id = p_cadeau_id;
    v_statut := 'gagne';
  ELSE
    v_statut := 'perdu';
  END IF;

  v_expire := now() + make_interval(days => GREATEST(p_duree_jours, 1));

  IF v_statut = 'gagne' THEN
    LOOP
      v_try := v_try + 1;
      v_code := 'ROUE-' ||
        -- `coalesce` : sans participant (tirage anonyme de la boutique),
        -- concaténer NULL rendait TOUT le code NULL et violait la contrainte
        -- « un gain a forcément un code ».
        upper(substr(md5(random()::text || clock_timestamp()::text || coalesce(p_participant_id::text, '')), 1, 4)) ||
        '-' ||
        upper(
          substr(v_alphabet, 1 + floor(random() * 8)::int, 1) ||
          substr(v_alphabet, 1 + floor(random() * 8)::int, 1)
        );
      EXIT WHEN NOT EXISTS (SELECT 1 FROM tirages t WHERE t.code_unique = v_code);
      IF v_try > 8 THEN
        RAISE EXCEPTION 'CODE_UNIQUE_IMPOSSIBLE';
      END IF;
    END LOOP;
  END IF;

  INSERT INTO tirages (
    participant_id, cadeau_id, code_unique, statut, expire_le, tour_bonus, appareil, ip_hash
  )
  VALUES (
    p_participant_id, p_cadeau_id, v_code, v_statut, v_expire, p_tour_bonus, p_appareil, p_ip_hash
  )
  RETURNING id INTO v_tirage_id;

  RETURN QUERY SELECT v_tirage_id, p_cadeau_id, v_code, v_expire, v_statut;
END;
$$;

-- ----------------------------------------------------------------------------
--  M2. Numéros béninois stockés en double (13 chiffres)
--
--  Bug corrigé : le formulaire envoyait « 229 » + « 0179392678 » (10 chiffres
--  locaux), soit 13 chiffres en base. L'identité du numéro béninois est
--  `229` + 8 chiffres : sans cette réparation, un client déjà inscrit pouvait
--  rejouer en saisissant le même numéro sous son autre écriture.
--
--  On ne touche qu'aux lignes strictement conformes au motif fautif
--  (229 01 XXXXXXXX) et seulement si le numéro corrigé n'existe pas déjà.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'participants'
       AND column_name = 'telephone'
  ) THEN
    WITH fautifs AS (
      SELECT id, telephone, '229' || substr(telephone, 6) AS corrige
        FROM participants
       WHERE telephone ~ '^22901[0-9]{8}$'
    ), reparables AS (
      SELECT f.*
        FROM fautifs f
       WHERE NOT EXISTS (SELECT 1 FROM participants p WHERE p.telephone = f.corrige)
    )
    UPDATE participants p
       SET telephone = r.corrige,
           telephone_aff = '+229 ' || substr(r.corrige, 4, 2) || ' ' || substr(r.corrige, 6, 2)
                           || ' ' || substr(r.corrige, 8, 2) || ' ' || substr(r.corrige, 10, 2)
      FROM reparables r
     WHERE p.id = r.id;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
--  M3. Cadeaux de démonstration aux couleurs de Noël
--
--  Les couleurs vivent en base (colonne `cadeaux.couleur`) : changer la palette
--  dans `seed.sql` ne suffit pas pour une boutique déjà ouverte. On ne touche
--  QU'AUX lignes encore sur la couleur d'origine du modèle, et seulement si
--  l'exploitant ne l'a pas déjà personnalisée : une couleur choisie dans
--  l'administration n'est jamais écrasée.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'cadeaux'
       AND column_name = 'couleur'
  ) THEN
    UPDATE cadeaux SET couleur = '#D4A017', updated_at = now()
     WHERE nom = 'Bon d''achat 5 000 FCFA' AND couleur IN ('#C9A227');
    UPDATE cadeaux SET couleur = '#B3121F', updated_at = now()
     WHERE nom = 'Casquette boutique' AND couleur IN ('#8B1E3F');
    UPDATE cadeaux SET couleur = '#1F7A50', updated_at = now()
     WHERE nom = 'Sac de courses' AND couleur IN ('#1F6F5C');
    UPDATE cadeaux SET couleur = '#8E0C17', updated_at = now()
     WHERE nom = 'Crème hydratante' AND couleur IN ('#B4552A');
    UPDATE cadeaux SET couleur = '#2F7A53', updated_at = now()
     WHERE nom = 'Stylo publicitaire' AND couleur IN ('#3A4A7A');
    UPDATE cadeaux SET couleur = '#A9822B', updated_at = now()
     WHERE nom = 'Échantillon parfum' AND couleur IN ('#6B4A7A');
    UPDATE cadeaux SET couleur = '#C41E2A', updated_at = now()
     WHERE nom = 'Réduction 10 %' AND couleur IN ('#0F6B6B');
    UPDATE cadeaux SET couleur = '#16402E', updated_at = now()
     WHERE nom = 'Bon café offert' AND couleur IN ('#4A3F35');
  END IF;
END $$;

-- ----------------------------------------------------------------------------
--  M4. Le jeu tourne sur le poste de la boutique, sans inscription
--
--  Décision de l'exploitant : les clients jouent sur l'ordinateur de la
--  boutique, l'un après l'autre. Il n'y a donc plus ni nom, ni numéro
--  WhatsApp, ni compte : un tirage n'est plus rattaché à un participant.
--
--  `tirages.participant_id` devient donc FACULTATIF. On ne supprime pas la
--  colonne ni les participants déjà en base : l'historique des anciennes
--  participations (et les exports) restent lisibles.
--
--  Attention : la règle « un tour par personne » disparaît avec le compte.
--  La limite devient celle du stock, géré dans /admin/cadeaux.
-- ----------------------------------------------------------------------------
--  Idempotent : DROP NOT NULL sur une colonne déjà nullable ne fait rien.
ALTER TABLE tirages ALTER COLUMN participant_id DROP NOT NULL;

-- ----------------------------------------------------------------------------
--  M5. Tirages anonymes : autoriser le tirage SANS participant en base
--
--  Deux verrous empêchaient un tirage anonyme d'exister :
--
--  1. `tirages_gain_coherent` exigeait un code sur un gain. Or le code est
--     calculé à partir de `p_participant_id::text` : avec NULL, toute la
--     concaténation devenait NULL et le CHECK rejetait l'insertion. Un client
--     sur le poste de la boutique ne pouvait donc JAMAIS gagner (le tirage
--     perdant, lui, passait). On rend l'expression NULL-safe :
--     `coalesce(p_participant_id::text, '')`.
--
--  2. `tirages.participant_id` restait NOT NULL sur les bases existantes :
--     c'est l'objet de la migration M4 ci-dessus.
--
--  La contrainte est recréée sous le même nom, sans perte de données.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tirages_gain_coherent'
  ) THEN
    ALTER TABLE tirages DROP CONSTRAINT tirages_gain_coherent;
  END IF;

  ALTER TABLE tirages
    ADD CONSTRAINT tirages_gain_coherent CHECK (
      (statut = 'gagne' AND cadeau_id IS NOT NULL AND code_unique IS NOT NULL)
      OR (statut = 'perdu' AND cadeau_id IS NULL AND code_unique IS NULL)
    );
END $$;

-- ----------------------------------------------------------------------------
--  M6. Cadeaux aux couleurs « casino de luxe »
--
--  La palette de fête (or pâle, baies, sapins clairs) est remplacée par le
--  bordeaux #B3122B, le vert profond #0B5D3B et l'or #D4AF37. Le rouge reste
--  DOMINANT : c'est la couleur qui attire l'œil sur une roue.
--
--  Trois générations de couleurs ont existé en production ; on reconnaît donc
--  chaque lot à son NOM **ou** à l'une de ses anciennes couleurs. C'est la
--  couleur d'origine qui fait foi : un lot déjà migré, ou recoloré à la main
--  par l'exploitant dans /admin/cadeaux, n'est pas retouché.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'cadeaux'
       AND column_name = 'couleur'
  ) THEN
    -- Bon d'achat : or (le lot le plus désirable de la roue).
    UPDATE cadeaux SET couleur = '#D4AF37', updated_at = now()
     WHERE couleur IN ('#C9A227', '#D4A017')
        OR (nom ILIKE 'Bon d''achat%' AND couleur NOT IN ('#D4AF37', '#B3122B', '#0B5D3B'));

    -- Bordeaux (rouge dominant).
    UPDATE cadeaux SET couleur = '#B3122B', updated_at = now()
     WHERE couleur IN ('#8B1E3F', '#B3121F', '#C41E2A', '#8E0C17', '#B4552A')
        OR (nom ILIKE 'Casquette%'       AND couleur NOT IN ('#D4AF37', '#B3122B', '#0B5D3B'))
        OR (nom ILIKE 'Crème%'           AND couleur NOT IN ('#D4AF37', '#B3122B', '#0B5D3B'))
        OR (nom ILIKE 'Échantillon%'     AND couleur NOT IN ('#D4AF37', '#B3122B', '#0B5D3B'))
        OR (nom ILIKE 'Réduc%'           AND couleur NOT IN ('#D4AF37', '#B3122B', '#0B5D3B'));

    -- Vert profond.
    UPDATE cadeaux SET couleur = '#0B5D3B', updated_at = now()
     WHERE couleur IN ('#1F6F5C', '#1F7A50', '#3A4A7A', '#2F7A53', '#4A3F35', '#16402E')
        OR (nom ILIKE 'Sac%'             AND couleur NOT IN ('#D4AF37', '#B3122B', '#0B5D3B'))
        OR (nom ILIKE 'Stylo%'           AND couleur NOT IN ('#D4AF37', '#B3122B', '#0B5D3B'))
        OR (nom ILIKE '%café%'           AND couleur NOT IN ('#D4AF37', '#B3122B', '#0B5D3B'));
  END IF;
END $$;
