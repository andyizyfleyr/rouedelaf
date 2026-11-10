/** Concatène des classes conditionnelles (mini clsx, zéro dépendance). */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
