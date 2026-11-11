-- ============================================================================
--  ROUE DE LA FORTUNE — SCHÉMA POSTGRES COMPLET (Neon)
--  Fichier : sql/schema.sql
--  Exécution : node scripts/db-setup.mjs   (ou psql < sql/schema.sql)
--  Idempotent : peut être relancé sans casser une base existante.
-- ============================================================================
--
--  IMPORTANT — SÉCURITÉ (RLS) :
--  Neon est un Postgres classique. La clé API Neon (DATABASE_URL) est
--  équivalente à un rôle serveur : elle est utilisée UNIQUEMENT dans les
--  Route Handlers / Server Actions (jamais dans le navigateur).
--
--  RLS est activé + FORCÉ sur toutes les tables : même si un jour la chaîne
--  de connexion fuite côté client (proxy, extension…), un client anonyme
--  (rôle PUBLIC / anon) ne peut rien lire ni écrire. Seul le rôle
--  propriétaire (la connexion serveur) contourne RLS. On ajoute des
--  politiques explicites pour le rôle applicatif.
--
--  Si vous migrez un jour vers Supabase : changez simplement les GRANT /
--  politiques vers les rôles `anon` et `authenticated`, la logique est la
--  même (aucune politique d'écriture pour anon).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS & RÔLE APPLICATIF
-- ----------------------------------------------------------------------------
-- gen_random_uuid() est natif depuis PostgreSQL 13 : aucune extension requise.

-- Rôle utilisé par l'application (sans LOGIN : la connexion passe par le rôle
-- propriétaire de la base, on ne fait que des GRANT pour la lisibilité).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'roue_app') THEN
    CREATE ROLE roue_app NOLOGIN;
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 1. PARAMÈTRES (table clé/valeur éditable depuis /admin/reglages)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parametres (
  cle         text PRIMARY KEY,
  valeur      text NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. PARTICIPANTS
--    Un numéro WhatsApp = une seule participation (contrainte UNIQUE).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS participants (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom             text NOT NULL,
  telephone       text NOT NULL,               -- normalisé : 229XXXXXXXX (chiffres seuls)
  telephone_aff   text,                        -- jolie écriture pour l'export CSV
  source          text NOT NULL DEFAULT 'direct',
  code_parrain    text UNIQUE,                 -- code partagé aux amis (1 tour bonus)
  consentement    boolean NOT NULL DEFAULT false,
  tours_bonus     integer NOT NULL DEFAULT 0,  -- tours gagnés via parrainage
  appareil        text,                        -- hash de l'empreinte navigateur (anti-abus)
  ip_hash         text,                        -- hash de l'IP (jamais l'IP en clair)
  derniere_ip_hash text,
  bloque          boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT participants_telephone_unique UNIQUE (telephone),
  CONSTRAINT participants_nom_longueur CHECK (char_length(nom) BETWEEN 2 AND 80),
  CONSTRAINT participants_telephone_format CHECK (telephone ~ '^[0-9]{8,15}$')
);

COMMENT ON TABLE participants IS 'Clients qui ont joué. telephone = identifiant unique (1 participation par numéro).';

-- ----------------------------------------------------------------------------
-- 3. CADEAUX
--    `probabilite` est un POIDS RELATIF (0-100). Les lots indisponibles
--    (stock 0, inactifs) sont exclus ; les poids restants sont renormalisés.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cadeaux (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom          text NOT NULL,
  description  text,
  image_url    text,
  stock        integer NOT NULL DEFAULT 0,
  probabilite  numeric(6,2) NOT NULL DEFAULT 0,
  couleur      text NOT NULL DEFAULT '#B3122B',
  icone        text NOT NULL DEFAULT '🎁',     -- emoji affiché sur la roue
  actif        boolean NOT NULL DEFAULT true,
  ordre        integer NOT NULL DEFAULT 0,     -- ordre d'affichage sur la roue
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cadeaux_stock_positif CHECK (stock >= 0),
  CONSTRAINT cadeaux_proba_valide CHECK (probabilite >= 0 AND probabilite <= 100),
  CONSTRAINT cadeaux_couleur_hex CHECK (couleur ~* '^#[0-9a-f]{6}$')
);

COMMENT ON TABLE cadeaux IS 'Catalogue des lots. probabilite = poids relatif en %, renormalisé sur les lots disponibles.';

-- ----------------------------------------------------------------------------
-- 4. TIRAGES
--    statut : 'gagne' (cadeau_id renseigné) ou 'perdu' (cadeau_id NULL).
--    code_unique : présente uniquement pour les gains (usage unique).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tirages (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- NULL = tirage joué sur le poste de la boutique, sans compte client
  -- (voir migration M4 : le jeu n'a plus d'inscription).
  participant_id bigint REFERENCES participants(id) ON DELETE CASCADE,
  -- SET NULL : supprimer un lot du catalogue ne doit pas être impossible sous
  -- prétexte qu'il a déjà été gagné. Le nom/la couleur sont recopiés dans les
  -- colonnes ci-dessous, donc l'historique reste lisible (voir M8).
  cadeau_id      bigint REFERENCES cadeaux(id) ON DELETE SET NULL,
  -- Copie figée de l'identité du lot au moment du tirage.
  cadeau_nom     text,
  cadeau_couleur text,
  cadeau_icone   text,
  cadeau_image_url text,
  code_unique    text UNIQUE,                  -- code lisible ex. ROUE-7F3K-92QP
  statut         text NOT NULL,
  recupere       boolean NOT NULL DEFAULT false,
  recupere_le    timestamptz,
  expire_le      timestamptz NOT NULL,
  tour_bonus     boolean NOT NULL DEFAULT false, -- tirage offert via parrainage
  appareil       text,
  ip_hash        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tirages_statut_valide CHECK (statut IN ('gagne', 'perdu')),
  CONSTRAINT tirages_gain_coherent CHECK (
    (statut = 'gagne' AND code_unique IS NOT NULL)
    OR (statut = 'perdu' AND cadeau_id IS NULL AND code_unique IS NULL)
  )
);

COMMENT ON TABLE tirages IS 'Un tirage par participation (+ tours bonus). Le gagnant est décidé côté serveur.';

-- ----------------------------------------------------------------------------
-- 5. PARRAINAGES (bouton « partager à un ami = 1 tour en plus »)
--    Le parrain obtient un tour bonus quand un filleul s'inscrit via son code.
-- ----------------------------------------------------------------------------
-- Photos de cadeaux, stockées en base (voir src/server/images.ts).
-- `detoure_le` : NULL = pas encore passé par le détourage automatique.
-- `detourage_source` : octets d'origine, pour pouvoir revenir en arrière.
CREATE TABLE IF NOT EXISTS images_cadeaux (
  nom              text PRIMARY KEY,
  type             text NOT NULL,
  donnees          bytea NOT NULL,
  taille           integer NOT NULL,
  cree_le          timestamptz NOT NULL DEFAULT now(),
  detoure_le       timestamptz,
  detourage_source bytea
);

CREATE TABLE IF NOT EXISTS parrainages (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parrain_id     bigint NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  filleul_id     bigint NOT NULL UNIQUE REFERENCES participants(id) ON DELETE CASCADE,
  code_parrain   text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parrainages_pas_soi_meme CHECK (parrain_id <> filleul_id)
);

-- ----------------------------------------------------------------------------
-- 6. (ancien emplacement des codes OTP — fonctionnalité retirée)
--    La vérification du numéro par code WhatsApp a été supprimée : l'étape
--    n'apportait rien sans envoi réel et ajoutait de la friction en boutique.
--    La contrainte d'unicité sur participants.telephone assure toujours
--    « une participation par numéro ».
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 7. SESSIONS DE JEU (liaison participant ↔ navigateur, signée par cookie)
--    Empêche de rejouer /roue avec le participant de quelqu'un d'autre.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions_jeu (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id bigint NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  token_hash     text NOT NULL,
  expire_le      timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 8. JOURNAL D'AUDIT ADMIN (traçabilité des remises de cadeaux)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_admin (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action     text NOT NULL,
  details    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
--  INDEX
-- ============================================================================
-- Participants : recherche par numéro (très fréquente), tri par date, filtres admin.
CREATE UNIQUE INDEX IF NOT EXISTS participants_telephone_idx ON participants (telephone);
CREATE INDEX IF NOT EXISTS participants_created_at_idx ON participants (created_at DESC);
CREATE INDEX IF NOT EXISTS participants_source_idx ON participants (source);
-- participants.code_parrain : UNIQUE ci-dessus ⇒ index implicite (recherche du parrain).
CREATE INDEX IF NOT EXISTS participants_appareil_idx ON participants (appareil) WHERE appareil IS NOT NULL;

-- Cadeaux : liste de la roue = actifs triés.
CREATE INDEX IF NOT EXISTS cadeaux_actif_ordre_idx ON cadeaux (actif, ordre) WHERE actif;

-- Tirages : dashboard, historique joueur, stats par jour, codes scannés.
CREATE INDEX IF NOT EXISTS tirages_participant_idx ON tirages (participant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tirages_statut_idx ON tirages (statut);
CREATE INDEX IF NOT EXISTS tirages_cadeau_idx ON tirages (cadeau_id) WHERE cadeau_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tirages_created_at_idx ON tirages (created_at DESC);
CREATE INDEX IF NOT EXISTS tirages_code_idx ON tirages (upper(code_unique)) WHERE code_unique IS NOT NULL;
CREATE INDEX IF NOT EXISTS tirages_expire_idx ON tirages (expire_le) WHERE statut = 'gagne' AND NOT recupere;
CREATE INDEX IF NOT EXISTS tirages_non_recuperes_idx ON tirages (cadeau_id) WHERE statut = 'gagne' AND NOT recupere;
-- Classement des gagnants récents pour l'écran boutique (Realtime).
CREATE INDEX IF NOT EXISTS tirages_gagnants_recents_idx ON tirages (created_at DESC) WHERE statut = 'gagne';

-- Sessions : lookup par token haché.
CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions_jeu (token_hash);
CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions_jeu (expire_le);

-- Parrainages
CREATE INDEX IF NOT EXISTS parrainages_parrain_idx ON parrainages (parrain_id);

-- ============================================================================
--  FONCTIONS & TRIGGERS
-- ============================================================================

-- 9.1 Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION trg_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS participants_touch ON participants;
CREATE TRIGGER participants_touch BEFORE UPDATE ON participants
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

DROP TRIGGER IF EXISTS cadeaux_touch ON cadeaux;
CREATE TRIGGER cadeaux_touch BEFORE UPDATE ON cadeaux
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

DROP TRIGGER IF EXISTS parametres_touch ON parametres;
CREATE TRIGGER parametres_touch BEFORE UPDATE ON parametres
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

-- 9.2 Garde-fou stock : on refuse un stock négatif même en concurrence.
CREATE OR REPLACE FUNCTION trg_cadeaux_stock_non_negatif()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stock < 0 THEN
    RAISE EXCEPTION 'Stock négatif interdit pour le cadeau %', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cadeaux_stock_guard ON cadeaux;
CREATE TRIGGER cadeaux_stock_guard BEFORE UPDATE OF stock ON cadeaux
  FOR EACH ROW EXECUTE FUNCTION trg_cadeaux_stock_non_negatif();

-- 9.3 Paramètres : lecture typée avec valeur par défaut.
CREATE OR REPLACE FUNCTION param_int(p_cle text, p_defaut integer)
RETURNS integer
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(regexp_replace(valeur, '[^0-9-]', '', 'g'), '')::integer
       FROM parametres WHERE cle = p_cle),
    p_defaut
  );
$$;

-- ============================================================================
--  FONCTION DE TIRAGE ATOMIQUE (cœur du jeu)
--  Elle est appelée par le serveur (Route Handler) avec le gagnant déjà choisi
--  par crypto.randomInt — mais c'est ELLE qui garantit l'atomicité du stock :
--  décrément conditionnel `WHERE stock > 0`, re-vérification, annulation.
--  Aucune décision de hasard ici : le hasard est fait dans Node (crypto).
--  Retour : (tirage_id, cadeau_id, code_unique, expire_le, statut)
-- ============================================================================
CREATE OR REPLACE FUNCTION enregistrer_tirage(
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
  v_alphabet   text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sans I, O, 0, 1 (lisibilité)
  v_try        integer := 0;
  v_tours_max  integer;
  v_bonus      integer;
  v_deja       integer;
  v_bloque     boolean;
BEGIN
  -- 0) VERROU SUR LE PARTICIPANT + VÉRIFICATION DU DROIT DE JOUER.
  --
  --    Depuis la migration M4, le jeu tourne sur le poste de la boutique :
  --    un tirage peut être anonyme (p_participant_id NULL) et il n'y a alors
  --    AUCUNE limite de tours — la limite, c'est le stock des cadeaux.
  --
  --    Quand un participant EST fourni (anciennes participations, ou jeu à
  --    distance), « un tour par personne » reste garanti ici, et pas dans
  --    Node : deux onglets arrivent en parallèle sur ce même verrou et sont
  --    sérialisés, le second reçoit TOURS_EPUISES.
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

  -- 1) Verrou pessimiste sur la ligne du cadeau : deux joueurs simultanés
  --    ne peuvent pas décrémenter le même stock en dessous de zéro.
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

  -- 2) Génération d'un code lisible unique (ROUE-XXXX-YY), réessai si collision.
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

  -- 3) Insertion du tirage.
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

COMMENT ON FUNCTION enregistrer_tirage IS
  'Enregistre un tirage de façon atomique : verrouille le participant, vérifie ses tours restants, décrémente le stock avec verrou, génère le code unique et calcule l''expiration.';

-- ============================================================================
--  VUE « DERNIERS GAGNANTS » (écran boutique /admin/ecran, Realtime)
-- ============================================================================
CREATE OR REPLACE VIEW derniers_gagnants AS
SELECT
  t.id,
  p.nom,
  p.telephone_aff,
  c.nom  AS cadeau_nom,
  c.couleur,
  t.created_at
FROM tirages t
JOIN participants p ON p.id = t.participant_id
LEFT JOIN cadeaux c ON c.id = t.cadeau_id
WHERE t.statut = 'gagne'
ORDER BY t.created_at DESC
LIMIT 50;

-- ============================================================================
--  VUES DE STATISTIQUES (dashboard admin)
-- ============================================================================
CREATE OR REPLACE VIEW stats_jour AS
SELECT
  date_trunc('day', t.created_at)::date AS jour,
  count(*)                              AS tirages,
  count(*) FILTER (WHERE t.statut = 'gagne') AS gagnes,
  count(*) FILTER (WHERE t.statut = 'gagne' AND t.recupere) AS recuperes
FROM tirages t
GROUP BY 1
ORDER BY 1;

-- ============================================================================
--  SÉCURITÉ : RLS (Row Level Security)
--
--  Deux modes de déploiement possibles, et le même fichier couvre les deux :
--
--  A) NEON (par défaut) — l'application se connecte avec le rôle PROPRIÉTAIRE
--     des tables (DATABASE_URL). RLS est ACTIVÉ mais pas FORCÉ : le
--     propriétaire contourne RLS, un client anonyme non. Comme AUCUNE
--     politique n'est accordée à PUBLIC, un accès anonyme lit 0 ligne et
--     écrit 0 ligne. C'est la protection recherchée.
--
--  B) SUPABASE / autre — si l'application utilise un rôle NON propriétaire
--     (moins privilégié), il suffit d'appartenir au rôle `roue_app` : une
--     politique permissive lui est déjà accordée ci-dessous.
--
--  ⚠️ Ne PAS utiliser FORCE ROW LEVEL SECURITY sans politique pour le rôle
--  applicatif : cela bloquerait l'application elle-même (piège classique).
-- ============================================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'parametres', 'participants', 'cadeaux', 'tirages',
    'parrainages', 'sessions_jeu', 'journal_admin'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO roue_app', t);
  END LOOP;
END
$$;

-- Politique du rôle applicatif non propriétaire (mode B).
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'parametres', 'participants', 'cadeaux', 'tirages',
    'parrainages', 'sessions_jeu', 'journal_admin'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_acces_complet ON %I', t);
    EXECUTE format(
      'CREATE POLICY app_acces_complet ON %I FOR ALL TO roue_app USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END
$$;

-- Aucune politique pour PUBLIC / anon : accès refusé par défaut.
-- Les comptes anonymes ne doivent jamais lire une table directement :
-- tout passe par les Route Handlers du serveur Next.js.

-- Vues : jamais exposées à PUBLIC non plus.
REVOKE ALL ON derniers_gagnants, stats_jour FROM PUBLIC;
GRANT SELECT ON derniers_gagnants, stats_jour TO roue_app;

-- Séquences : l'application doit pouvoir générer les identifiants.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO roue_app;

-- Exécution des fonctions (dont enregistrer_tirage) réservée à l'app.
REVOKE ALL ON FUNCTION enregistrer_tirage(bigint, bigint, integer, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enregistrer_tirage(bigint, bigint, integer, boolean, text, text) TO roue_app;

-- ============================================================================
--  RÉGLAGES PAR DÉFAUT
-- ============================================================================
INSERT INTO parametres (cle, valeur, description) VALUES
  ('tours_max',                 '1',  'Nombre de tours offerts à chaque participation'),
  ('duree_validite_code_jours', '14', 'Durée de validité d''un code cadeau (jours)'),
  ('duree_session_minutes',     '120','Durée d''une session de jeu (minutes)'),
  ('active_jeu',                'true','Interrupteur général du jeu (true/false)'),
  ('message_perdu',             'Pas de chance cette fois ! Voici un bon de réduction pour votre prochaine visite.', 'Message affiché aux perdants'),
  ('reduction_consolation',     '10', 'Pourcentage de réduction offert aux perdants'),
  ('tours_bonus_parrainage',    '1',  'Tours bonus accordés quand un ami inscrit avec votre lien')
ON CONFLICT (cle) DO NOTHING;

-- ============================================================================
--  MIGRATION : retrait de la vérification OTP
--  Les bases créées avant la suppression portent encore la table et les deux
--  réglages associés. On les retire ici pour que `npm run db:setup` remette
--  n'importe quelle base dans l'état attendu.
-- ============================================================================
DROP TABLE IF EXISTS otp_codes;
DELETE FROM parametres WHERE cle IN ('otp_tentatives_max', 'otp_validite_minutes');

COMMIT;

-- ============================================================================
--  FIN DU SCHÉMA
-- ============================================================================
