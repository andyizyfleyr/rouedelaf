"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigerAdmin } from "@/lib/session";
import {
  ajusterStock,
  basculerActifCadeau,
  creerCadeau,
  journaliser,
  modifierCadeau,
  supprimerCadeau,
} from "@/server/data";

/**
 * Server Actions de gestion du catalogue.
 *
 * Toutes les actions commencent par `exigerAdmin()` : sans session admin
 * valide, elles lèvent une erreur. Une Server Action est un point d'entrée
 * HTTP public : elle doit se protéger elle-même, indépendamment de la page.
 */

export type EtatAction = { ok?: boolean; erreur?: string; message?: string };

const schemaCadeau = z.object({
  nom: z.string().trim().min(2, "Nom trop court.").max(80, "Nom trop long."),
  description: z.string().trim().max(300).optional().nullable(),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .refine(
      (v) => !v || /^https?:\/\//i.test(v) || v.startsWith("/"),
      "L'image doit être une URL http(s) ou un chemin commençant par /.",
    ),
  stock: z.coerce.number().int().min(0, "Le stock ne peut pas être négatif.").max(1_000_000),
  probabilite: z.coerce.number().min(0).max(100),
  couleur: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue (#RRGGBB)."),
  icone: z.string().trim().min(1).max(8),
  ordre: z.coerce.number().int().min(0).max(999),
  actif: z.coerce.boolean().optional(),
});

function lireFormulaire(formData: FormData) {
  return schemaCadeau.safeParse({
    nom: formData.get("nom"),
    description: formData.get("description") || null,
    imageUrl: formData.get("imageUrl") || null,
    stock: formData.get("stock"),
    probabilite: formData.get("probabilite"),
    couleur: formData.get("couleur"),
    icone: formData.get("icone"),
    ordre: formData.get("ordre") || 0,
    actif: formData.get("actif") === "on" || formData.get("actif") === "true",
  });
}

export async function actionCreerCadeau(
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    await exigerAdmin();
  } catch {
    return { erreur: "Session expirée. Reconnectez-vous." };
  }

  const analyse = lireFormulaire(formData);
  if (!analyse.success) {
    return { erreur: analyse.error.issues[0]?.message ?? "Données invalides." };
  }

  try {
    await creerCadeau({
      ...analyse.data,
      description: analyse.data.description ?? null,
      imageUrl: analyse.data.imageUrl ?? null,
      actif: analyse.data.actif ?? true,
    });
    await journaliser("cadeau_cree", { nom: analyse.data.nom });
    revalidatePath("/admin/cadeaux");
    revalidatePath("/roue");
    return { ok: true, message: `« ${analyse.data.nom} » ajouté.` };
  } catch (e) {
    console.error("[admin] création cadeau", e);
    return { erreur: "Impossible d'ajouter ce cadeau." };
  }
}

export async function actionModifierCadeau(
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    await exigerAdmin();
  } catch {
    return { erreur: "Session expirée. Reconnectez-vous." };
  }

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { erreur: "Cadeau introuvable." };

  const analyse = lireFormulaire(formData);
  if (!analyse.success) {
    return { erreur: analyse.error.issues[0]?.message ?? "Données invalides." };
  }

  try {
    await modifierCadeau(id, {
      ...analyse.data,
      description: analyse.data.description ?? null,
      imageUrl: analyse.data.imageUrl ?? null,
      actif: analyse.data.actif ?? true,
    });
    await journaliser("cadeau_modifie", { id, nom: analyse.data.nom });
    revalidatePath("/admin/cadeaux");
    revalidatePath("/roue");
    return { ok: true, message: "Cadeau mis à jour." };
  } catch (e) {
    console.error("[admin] modification cadeau", e);
    return { erreur: "Impossible de modifier ce cadeau." };
  }
}

export async function actionBasculerActif(id: number, actif: boolean): Promise<EtatAction> {
  await exigerAdmin();
  await basculerActifCadeau(id, actif);
  revalidatePath("/admin/cadeaux");
  revalidatePath("/roue");
  return { ok: true, message: actif ? "Cadeau activé." : "Cadeau désactivé." };
}

export async function actionAjusterStock(id: number, delta: number): Promise<EtatAction> {
  await exigerAdmin();
  const stock = await ajusterStock(id, delta);
  revalidatePath("/admin/cadeaux");
  revalidatePath("/roue");
  return { ok: true, message: `Stock : ${stock}` };
}

export async function actionSupprimerCadeau(id: number): Promise<EtatAction> {
  await exigerAdmin();
  const resultat = await supprimerCadeau(id);
  if (!resultat.ok) return { erreur: resultat.raison ?? "Suppression impossible." };
  revalidatePath("/admin/cadeaux");
  revalidatePath("/roue");
  return { ok: true, message: "Cadeau supprimé." };
}
