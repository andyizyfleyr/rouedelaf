"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigerAdmin } from "@/lib/session";
import { enregistrerImage, TAILLE_IMAGE_MAX, TYPES_IMAGE } from "@/server/images";
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

/**
 * Enregistre la photo choisie dans l'admin.
 *
 * La photo vit EN BASE (table `images_cadeaux`) et non sur le disque : sur
 * Vercel le disque est en lecture seule sauf /tmp, qui n'est pas servi par le
 * CDN — un fichier aurait disparu au redéploiement suivant. Voir
 * src/server/images.ts. Le navigateur réduit déjà l'image à ~150 ko.
 */
async function enregistrerPhoto(fichier: File): Promise<{ url?: string; erreur?: string }> {
  if (!TYPES_IMAGE[fichier.type]) {
    return { erreur: "Format non pris en charge : utilisez un JPG, PNG, WEBP ou GIF." };
  }
  if (fichier.size > TAILLE_IMAGE_MAX) {
    return { erreur: "Image trop lourde : 3 Mo maximum." };
  }
  const resultat = await enregistrerImage(Buffer.from(await fichier.arrayBuffer()), fichier.type);
  return "url" in resultat ? { url: resultat.url } : { erreur: resultat.erreur };
}

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

/** Photo uploadée prioritaire ; sinon l'URL saisie (ou vide). */
async function choisirImage(
  formData: FormData,
  imageUrl: string | null | undefined,
): Promise<{ imageUrl: string | null; erreur?: string }> {
  const fichier = formData.get("photo");
  if (fichier instanceof File && fichier.size > 0) {
    const resultat = await enregistrerPhoto(fichier);
    if (resultat.erreur) return { imageUrl: null, erreur: resultat.erreur };
    return { imageUrl: resultat.url ?? null };
  }
  return { imageUrl: imageUrl || null };
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
    return { erreur: analyse.error.issues[0]?.message ?? "Valeurs invalides." };
  }

  const image = await choisirImage(formData, analyse.data.imageUrl);
  if (image.erreur) return { erreur: image.erreur };

  try {
    await creerCadeau({
      ...analyse.data,
      description: analyse.data.description ?? null,
      imageUrl: image.imageUrl,
      actif: analyse.data.actif ?? true,
    });
    await journaliser("cadeau_cree", { nom: analyse.data.nom });
    revalidatePath("/admin/cadeaux");
    revalidatePath("/roue");
    return { ok: true, message: "Cadeau ajouté." };
  } catch (e) {
    console.error("[admin] création cadeau", e);
    return { erreur: "Création impossible." };
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

  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return { erreur: "Cadeau introuvable." };

  const analyse = lireFormulaire(formData);
  if (!analyse.success) {
    return { erreur: analyse.error.issues[0]?.message ?? "Valeurs invalides." };
  }

  const image = await choisirImage(formData, analyse.data.imageUrl);
  if (image.erreur) return { erreur: image.erreur };

  try {
    await modifierCadeau(id.data, {
      ...analyse.data,
      description: analyse.data.description ?? null,
      imageUrl: image.imageUrl,
      actif: analyse.data.actif ?? true,
    });
    await journaliser("cadeau_modifie", { id: id.data, nom: analyse.data.nom });
    revalidatePath("/admin/cadeaux");
    revalidatePath("/roue");
    return { ok: true, message: "Cadeau modifié." };
  } catch (e) {
    console.error("[admin] modification cadeau", e);
    return { erreur: "Modification impossible." };
  }
}

export async function actionBasculerActif(id: number, actif: boolean): Promise<EtatAction> {
  try {
    await exigerAdmin();
    await basculerActifCadeau(id, actif);
    revalidatePath("/admin/cadeaux");
    revalidatePath("/roue");
    return { ok: true };
  } catch {
    return { erreur: "Action impossible." };
  }
}

export async function actionAjusterStock(id: number, delta: number): Promise<EtatAction> {
  try {
    await exigerAdmin();
    await ajusterStock(id, delta);
    revalidatePath("/admin/cadeaux");
    revalidatePath("/roue");
    return { ok: true };
  } catch {
    return { erreur: "Ajustement impossible." };
  }
}

export async function actionSupprimerCadeau(id: number): Promise<EtatAction> {
  try {
    await exigerAdmin();
    await supprimerCadeau(id);
    await journaliser("cadeau_supprime", { id });
    revalidatePath("/admin/cadeaux");
    revalidatePath("/roue");
    return { ok: true, message: "Cadeau supprimé." };
  } catch (e) {
    console.error("[admin] suppression cadeau", e);
    return { erreur: "Suppression impossible : le cadeau est peut-être déjà gagné." };
  }
}
