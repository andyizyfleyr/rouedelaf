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

/** Normalise un numéro béninois/étranger en chiffres seuls (ex. 22997123456). */
export function normaliserTelephone(brut: string): string {
  let chiffres = brut.replace(/\D/g, "");

  // Retire l'indicatif international 00 en tête (ex. 0022997…)
  if (chiffres.startsWith("00")) chiffres = chiffres.slice(2);

  // Numéro local béninois saisi sans indicatif : 01 + 8 chiffres (10 chiffres),
  // ou les anciens formats 8 chiffres. On préfixe toujours par 229.
  if (/^\d{10}$/.test(chiffres) && chiffres.startsWith("01")) {
    return `229${chiffres.slice(2)}`;
  }
  if (/^\d{8}$/.test(chiffres)) {
    return `229${chiffres}`;
  }
  if (/^\d{10}$/.test(chiffres) && chiffres.startsWith("0")) {
    return `229${chiffres.slice(1)}`;
  }

  return chiffres;
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
