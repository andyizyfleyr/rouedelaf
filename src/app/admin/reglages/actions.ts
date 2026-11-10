"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigerAdmin } from "@/lib/session";
import { ecrireParametre } from "@/server/params";
import { journaliser } from "@/server/data";

/** Server Action d'enregistrement des réglages (protégée admin). */

export type EtatReglages = { ok?: boolean; message?: string; erreur?: string };

const schema = z.object({
  boutiqueNom: z.string().trim().min(1, "Le nom de la boutique est obligatoire.").max(60),
  boutiqueAdresse: z.string().trim().max(120),
  dureeValiditeCodeJours: z.coerce.number().int().min(1).max(365),
  reductionConsolation: z.coerce.number().int().min(0).max(100),
  messagePerdu: z.string().trim().max(500),
  activeJeu: z.coerce.boolean(),
});

export async function actionEnregistrerReglages(
  _etat: EtatReglages,
  formData: FormData,
): Promise<EtatReglages> {
  try {
    await exigerAdmin();
  } catch {
    return { erreur: "Session expirée. Reconnectez-vous." };
  }

  const analyse = schema.safeParse({
    boutiqueNom: formData.get("boutiqueNom"),
    boutiqueAdresse: formData.get("boutiqueAdresse"),
    dureeValiditeCodeJours: formData.get("dureeValiditeCodeJours"),
    reductionConsolation: formData.get("reductionConsolation"),
    messagePerdu: formData.get("messagePerdu"),
    activeJeu: formData.get("activeJeu") === "on",
  });

  if (!analyse.success) {
    return { erreur: analyse.error.issues[0]?.message ?? "Valeurs invalides." };
  }

  const d = analyse.data;
  try {
    await Promise.all([
      ecrireParametre("boutique_nom", d.boutiqueNom),
      ecrireParametre("boutique_adresse", d.boutiqueAdresse),
      ecrireParametre("duree_validite_code_jours", String(d.dureeValiditeCodeJours)),
      ecrireParametre("reduction_consolation", String(d.reductionConsolation)),
      ecrireParametre("message_perdu", d.messagePerdu || "Pas de chance cette fois !"),
      ecrireParametre("active_jeu", d.activeJeu ? "true" : "false"),
    ]);
    await journaliser("reglages_modifies", { ...d });
    // Les réglages sont lus à chaque rendu (mémoïsation par requête
    // uniquement, voir src/server/params.ts) : rafraîchir les pages suffit.
    // Le nom s'affiche sur TOUTES les pages (titre, bandeau, borne, écran) :
    // on rafraîchit l'ensemble plutôt que la seule page courante.
    revalidatePath("/", "layout");
    return { ok: true, message: "Réglages enregistrés." };
  } catch (e) {
    console.error("[admin] réglages", e);
    return { erreur: "Enregistrement impossible." };
  }
}
