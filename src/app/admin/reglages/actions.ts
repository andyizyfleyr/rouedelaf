"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigerAdmin } from "@/lib/session";
import { ecrireParametre } from "@/server/params";
import { journaliser } from "@/server/data";

/** Server Action d'enregistrement des réglages (protégée admin). */

export type EtatReglages = { ok?: boolean; message?: string; erreur?: string };

const schema = z.object({
  toursMax: z.coerce.number().int().min(1).max(10),
  dureeValiditeCodeJours: z.coerce.number().int().min(1).max(365),
  dureeSessionMinutes: z.coerce.number().int().min(15).max(720),
  reductionConsolation: z.coerce.number().int().min(0).max(100),
  otpTentativesMax: z.coerce.number().int().min(1).max(10),
  otpValiditeMinutes: z.coerce.number().int().min(1).max(60),
  toursBonusParrainage: z.coerce.number().int().min(0).max(10),
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
    toursMax: formData.get("toursMax"),
    dureeValiditeCodeJours: formData.get("dureeValiditeCodeJours"),
    dureeSessionMinutes: formData.get("dureeSessionMinutes"),
    reductionConsolation: formData.get("reductionConsolation"),
    otpTentativesMax: formData.get("otpTentativesMax"),
    otpValiditeMinutes: formData.get("otpValiditeMinutes"),
    toursBonusParrainage: formData.get("toursBonusParrainage"),
    messagePerdu: formData.get("messagePerdu"),
    activeJeu: formData.get("activeJeu") === "on",
  });

  if (!analyse.success) {
    return { erreur: analyse.error.issues[0]?.message ?? "Valeurs invalides." };
  }

  const d = analyse.data;
  try {
    await Promise.all([
      ecrireParametre("tours_max", String(d.toursMax)),
      ecrireParametre("duree_validite_code_jours", String(d.dureeValiditeCodeJours)),
      ecrireParametre("duree_session_minutes", String(d.dureeSessionMinutes)),
      ecrireParametre("reduction_consolation", String(d.reductionConsolation)),
      ecrireParametre("otp_tentatives_max", String(d.otpTentativesMax)),
      ecrireParametre("otp_validite_minutes", String(d.otpValiditeMinutes)),
      ecrireParametre("tours_bonus_parrainage", String(d.toursBonusParrainage)),
      ecrireParametre("message_perdu", d.messagePerdu || "Pas de chance cette fois !"),
      ecrireParametre("active_jeu", d.activeJeu ? "true" : "false"),
    ]);
    await journaliser("reglages_modifies", { ...d });
    revalidatePath("/admin");
    revalidatePath("/roue");
    return { ok: true, message: "Réglages enregistrés." };
  } catch (e) {
    console.error("[admin] réglages", e);
    return { erreur: "Enregistrement impossible." };
  }
}
