"use server";

import { exigerAdmin } from "@/lib/session";
import { detourerImagesExistantes } from "@/server/images";

/**
 * Server Action : détoure les photos produits qui ne l'ont pas encore été.
 *
 * Appelée une fois par chargement de /admin/cadeaux, côté navigateur, en
 * tâche de fond. Pourquoi une Server Action et pas un effet dans la page :
 * une page est un rendu — y lancer un traitement lourd le ferait attendre, et
 * une promesse non attendue serait tuée à la fin de la réponse.
 *
 * Le traitement est borné par appel (`detourerImagesExistantes`), et chaque
 * photo traitée est marquée en base : l'appel est donc idempotent et sans
 * effet une fois tout le catalogue passé.
 */
export async function rattraperDetourage(): Promise<{ traitees: number; restantes: number }> {
  await exigerAdmin();
  return detourerImagesExistantes(6);
}
