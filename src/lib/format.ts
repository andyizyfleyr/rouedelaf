/**
 * Utilitaires de formatage partagés client/serveur.
 * Aucune dépendance, aucun accès base : importable partout.
 */

const FUSEAU = "Africa/Porto-Novo";

/** Date lisible : « 24 nov. 2026 à 15:04 » */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: FUSEAU,
  }).format(d);
}

/** Date + heure : « 24 nov. 2026 à 15:04 » */
export function formatDateHeure(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const jour = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: FUSEAU,
  }).format(d);
  const heure = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSEAU,
  }).format(d);
  return `${jour} à ${heure}`;
}

/** Jour court pour les graphiques : « 24/11 » */
export function formatJourCourt(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: FUSEAU,
  }).format(d);
}

/** Montant en FCFA : « 5 000 FCFA » */
export function formatFCFA(montant: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(montant)} FCFA`;
}

/** Nombre compact : « 1 234 » */
export function formatNombre(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

/**
 * Compte à rebours lisible : « 3 j 4 h », « 2 h 10 min », « 12 min ».
 * Retourne null si la date est passée.
 */
export function tempsRestant(expireLe: Date | string): string | null {
  const fin = typeof expireLe === "string" ? new Date(expireLe) : expireLe;
  const diff = fin.getTime() - Date.now();
  if (diff <= 0) return null;

  const minutes = Math.floor(diff / 60_000);
  const heures = Math.floor(minutes / 60);
  const jours = Math.floor(heures / 24);

  if (jours >= 1) return `${jours} j ${heures % 24} h`;
  if (heures >= 1) return `${heures} h ${minutes % 60} min`;
  return `${Math.max(minutes, 1)} min`;
}

/**
 * Normalise un numéro en chiffres seuls, prêt pour la base.
 *
 * Un numéro béninois s'écrit aujourd'hui « 01 97 12 34 56 » (10 chiffres) mais
 * l'identité réelle est « 97 12 34 56 ». Sans cette réduction, le même client
 * s'inscrivait deux fois : « 2290197123456 » (13 chiffres) via le formulaire
 * actuel, et « 22997123456 » via un ancien format — le contrôle « un seul tour
 * par personne » ne voyait alors qu'un numéro différent à chaque fois.
 * On stocke donc toujours `229` + 8 chiffres pour le Bénin.
 */
export function normaliserTelephone(brut: string): string {
  let chiffres = brut.replace(/\D/g, "");

  // Retire l'indicatif international 00 en tête (ex. 0022997…)
  if (chiffres.startsWith("00")) chiffres = chiffres.slice(2);

  /**
   * Un numéro béninois a 8 chiffres significatifs. On accepte les écritures
   * courantes et on n'en garde que ces 8 chiffres :
   *   • 01 97 12 34 56 → on retire le préfixe « 01 » (plan de numérotation 2020) ;
   *   • 0 97 12 34 56  → on retire le 0 de tête ;
   *   • 97 12 34 56    → déjà nu.
   * Le piège est de ne retirer qu'un seul 0 sur « 0197123456 » : on obtient
   * alors 9 chiffres et un numéro qui n'existe pas.
   */
  const benin = (local: string): string => {
    if (local.length === 10 && local.startsWith("01")) return `229${local.slice(2)}`;
    if (local.length === 9 && local.startsWith("0")) return `229${local.slice(1)}`;
    return `229${local}`;
  };

  if (chiffres.startsWith("229")) {
    const local = chiffres.slice(3);
    if (local.length >= 8 && local.length <= 10) return benin(local);
  }
  // Numéro local béninois saisi sans indicatif.
  if (/^\d{10}$/.test(chiffres) && chiffres.startsWith("01")) return benin(chiffres);
  if (/^\d{8}$/.test(chiffres)) return benin(chiffres);
  if (/^\d{9}$/.test(chiffres) && chiffres.startsWith("0")) return benin(chiffres);

  return chiffres;
}

/**
 * Le numéro local est-il plausible pour cet indicatif ?
 *
 * Corrige un bug réel : sur `+229`, la saisie « 12 34 56 78 90 » était
 * acceptée telle quelle et créait un numéro à 13 chiffres inexistant. Un
 * numéro béninois compte 10 chiffres depuis 2020 (01 + 8), ou 8 en ancien
 * format ; les autres pays de la liste utilisent 9 ou 10 chiffres.
 */
export function longueursAttendues(indicatif: string): number[] {
  if (indicatif === "229") return [8, 10];
  if (indicatif === "228") return [8];
  return [9, 10];
}

/** Le numéro local (chiffres seuls, sans indicatif) est-il valide ? */
export function telephoneLocalValide(indicatif: string, local: string): boolean {
  if (!/^\d+$/.test(local)) return false;
  const attendus = longueursAttendues(indicatif);

  // Bénin : 8 chiffres (97 12 34 56) ou 10 chiffres commençant par 01
  // (0197123456). Un « 1234567890 » de 10 chiffres sans 01 est refusé : c'est
  // exactement le cas qui créait des numéros fantômes.
  if (indicatif === "229") {
    // 8 chiffres : ancien format local (97 12 34 56), le zéro de tête est une
    // habitude de saisie (« 01971234 » n'existe pas mais reste 8 chiffres).
    // 10 chiffres : nouveau format, obligatoirement 01 + 8.
    return local.length === 8 || (local.length === 10 && local.startsWith("01"));
  }

  // Autres pays : longueur attendue, avec tolérance d'un 0 de tête.
  return attendus.includes(local.length) || attendus.includes(local.replace(/^0/, "").length);
}

/** Affichage joli : « +229 97 12 34 56 » (fallback : le numéro brut). */
export function formaterTelephone(chiffres: string): string {
  if (chiffres.startsWith("229") && chiffres.length === 11) {
    const n = chiffres.slice(3);
    return `+229 ${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 6)} ${n.slice(6, 8)}`;
  }
  return `+${chiffres}`;
}

/** Masque un numéro pour l'affichage public : « +229 97 ** ** 56 » */
export function masquerTelephone(chiffres: string | null): string {
  if (!chiffres) return "—";
  const joli = formaterTelephone(chiffres);
  return joli.replace(/\d(?=\d{2})/g, (c, i) => (i > 6 && i < 12 ? "*" : c));
}

/** Slug de source (facebook → facebook). */
export function normaliserSource(source: string | null | undefined): string {
  const propre = (source ?? "").toLowerCase().trim().replace(/[^a-z0-9_-]/g, "");
  return propre || "direct";
}
