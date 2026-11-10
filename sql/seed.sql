-- ============================================================================
--  ROUE DE LA FORTUNE — DONNÉES DE DÉMONSTRATION
--  Fichier : sql/seed.sql   (exécuté par : npm run db:seed)
--  Idempotent : utilise ON CONFLICT / NOT EXISTS.
-- ============================================================================

BEGIN;

-- Cadeaux d'exemple adaptés à une boutique au Bénin.
-- Les probabilités sont des POIDS RELATIFS : elles sont renormalisées sur les
-- lots réellement disponibles au moment du tirage.
INSERT INTO cadeaux (nom, description, stock, probabilite, couleur, icone, actif, ordre) VALUES
  ('Bon d''achat 5 000 FCFA', 'Valable sur tout le magasin, sans minimum d''achat.', 10, 2,  '#D4A017', '🎟️', true, 1),
  ('Casquette boutique',      'Casquette brodée aux couleurs de la boutique.',        25, 12, '#B3121F', '🧢', true, 2),
  ('Sac de courses',          'Sac réutilisable en toile épaisse.',                   30, 15, '#1F7A50', '🛍️', true, 3),
  ('Crème hydratante',        'Soin visage 50 ml, peaux normales.',                   20, 10, '#8E0C17', '🧴', true, 4),
  ('Stylo publicitaire',      'Un petit souvenir utile.',                             80, 26, '#2F7A53', '🖊️', true, 5),
  ('Échantillon parfum',      'Miniature 5 ml de notre best-seller.',                 60, 20, '#A9822B', '🌸', true, 6),
  ('Réduction 10 %',          'Sur votre prochain passage en boutique.',             200, 15, '#C41E2A', '💸', true, 7),
  ('Bon café offert',         'Un café ou un jus offert à votre prochaine visite.',   40, 20, '#16402E', '☕', true, 8)
ON CONFLICT DO NOTHING;

-- Remarque : la case « perdue » est une case de la roue SANS ligne cadeau
-- correspondante en base (cadeau_id NULL dans tirages). On la garde ici
-- uniquement pour l'affichage, avec stock NULL... sauf que la colonne est
-- NOT NULL : on la supprime donc du catalogue et le serveur ajoute
-- dynamiquement les cases « perdues » nécessaires au calcul.

-- Nettoyage de sécurité si une exécution précédente a inséré la case perdue.
DELETE FROM cadeaux WHERE nom = 'Perdu — retentez demain';

COMMIT;
