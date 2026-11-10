/**
 * Types partagés entre le serveur et le navigateur.
 * (Aucun import Node ici : ce fichier est bundlé côté client.)
 */

/** Une case affichée sur la roue. */
export type CadeauRoue = {
  id: number;
  nom: string;
  couleur: string;
  icone: string;
  probabilite: number;
  stock: number;
};

/** Lot complet tel que manipulé par l'admin. */
export type Cadeau = CadeauRoue & {
  description: string | null;
  image_url: string | null;
  actif: boolean;
  ordre: number;
  created_at: string;
  updated_at: string;
  /** Stock - gains non encore récupérés (indicateur de tension). */
  gagnes_non_recuperes?: number;
};

/** Résultat renvoyé par l'API de tirage — décidé AVANT l'animation. */
export type ResultatTirageApi = {
  tirageId: number;
  statut: "gagne" | "perdu";
  /** Index de la case où l'aiguille doit s'arrêter. */
  caseIndex: number;
  /** Nombre total de cases (le client reconstruit la même roue). */
  nombreCases: number;
  cadeau: { id: number; nom: string; couleur: string; icone: string } | null;
  /** Code unique du cadeau (null si perdu). */
  code: string | null;
  /** QR code du code (data-URL générée par le serveur), null si perdu. */
  qrDataUrl?: string | null;
  expireLe: string | null;
  /** Bon de consolation éventuel (perdant). */
  reductionConsolation: number | null;
};

/** Session de jeu renvoyée au client après son inscription. */
export type SessionJeu = {
  participantId: number;
  nom: string;
  toursRestants: number;
  toursBonus: number;
  codeParrain: string;
};

/** Tirage affiché sur la page résultat. */
export type TirageResultat = {
  id: number;
  statut: "gagne" | "perdu";
  code_unique: string | null;
  recupere: boolean;
  expire_le: string;
  created_at: string;
  cadeau_nom: string | null;
  cadeau_couleur: string | null;
  cadeau_icone: string | null;
  cadeau_description: string | null;
  cadeau_image_url: string | null;
  reduction_consolation: number | null;
};

/** Données publiques du flux borne (aucune donnée personnelle sensible). */
export type FluxBorne = {
  gagnants: {
    id: number;
    nom: string;
    cadeau_nom: string | null;
    couleur: string | null;
    created_at: string;
  }[];
  totaux: { joueurs: number; gagnes: number };
};

/** Une ligne de l'écran boutique /admin/ecran. */
export type GagnantEcran = {
  id: number;
  nom: string;
  telephone_aff: string | null;
  cadeau_nom: string | null;
  couleur: string | null;
  created_at: string;
};

/** Statistiques du tableau de bord. */
export type StatsDashboard = {
  joueursTotal: number;
  joueursAujourdhui: number;
  tiragesTotal: number;
  gagnesTotal: number;
  recuperesTotal: number;
  enAttenteTotal: number;
  tauxVictoire: number;
  codesExpires: number;
  parJour: { jour: string; joueurs: number; gagnes: number; recuperes: number }[];
  parSource: { source: string; joueurs: number }[];
  parCadeau: {
    id: number;
    nom: string;
    couleur: string;
    stock: number;
    gagnes: number;
    recuperes: number;
  }[];
};

/** Ligne de la liste joueurs (export CSV). */
export type LigneJoueur = {
  id: number;
  nom: string;
  telephone: string;
  telephone_aff: string | null;
  source: string;
  created_at: string;
  consentement: boolean;
  bloque: boolean;
  cadeau_nom: string | null;
  statut: string | null;
  code_unique: string | null;
  recupere: boolean | null;
  tirage_le: string | null;
};
