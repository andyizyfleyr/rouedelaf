import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Suspense } from "react";

import { EcranResultat } from "@/components/client/EcranResultat";
import { boutique } from "@/lib/env";
import { lireSessionJeu } from "@/lib/session";
import { dernierTirageParticipant, tirageParId } from "@/server/data";
import { lireParametres } from "@/server/params";

export const metadata = {
  title: "Votre résultat",
  description: "Découvrez votre cadeau et votre code de retrait.",
};

/**
 * /resultat?t=ID — écran de fin.
 *
 * Le QR code du cadeau est généré CÔTÉ SERVEUR (lib qrcode), jamais côté
 * client : le code reste donc utilisable hors ligne et sans dépendance JS.
 * Un client ne peut consulter que SES propres tirages (session obligatoire).
 */
export default function PageResultat({ searchParams }: PageProps<"/resultat">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 flex-col gap-3 py-6">
          <div className="mx-auto size-16 animate-pulse rounded-full bg-white/5" />
          <div className="mx-auto h-8 w-48 animate-pulse rounded-lg bg-white/5" />
          <div className="carte-luxe h-56 animate-pulse" />
          <p className="text-center text-[12px] tracking-[0.2em] text-cendre/50 uppercase">
            Vérification de votre résultat…
          </p>
        </div>
      }
    >
      <Contenu searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenu({ searchParams }: { searchParams: PageProps<"/resultat">["searchParams"] }) {
  const session = await lireSessionJeu();
  if (!session) redirect("/jouer");

  const { t } = await searchParams;
  const idDemande = t ? Number.parseInt(String(t), 10) : NaN;

  const tirage = Number.isFinite(idDemande)
    ? await tirageParId(idDemande)
    : await dernierTirageParticipant(session.participantId);

  if (!tirage) redirect("/roue");

  // Sécurité : on vérifie que le tirage appartient bien au participant.
  const [proprietaire] = await verifierProprietaire(tirage.id);
  if (!proprietaire) redirect("/roue");

  const parametres = await lireParametres();

  // QR code du code cadeau : contenu = code seul, lu par /admin/scan.
  const qrDataUrl =
    tirage.statut === "gagne" && tirage.code_unique
      ? await QRCode.toDataURL(tirage.code_unique, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 420,
          color: { dark: "#0a0908", light: "#f8e7a8" },
        })
      : null;

  return (
    <EcranResultat
      tirage={tirage}
      qrDataUrl={qrDataUrl}
      messagePerdu={parametres.messagePerdu}
      boutique={{ nom: boutique.nom, adresse: boutique.adresse, whatsapp: boutique.whatsapp }}
    />
  );
}

async function verifierProprietaire(tirageId: number): Promise<[{ ok: boolean } | null]> {
  const session = await lireSessionJeu();
  if (!session) return [null];
  const { sql } = await import("@/lib/db");
  const [ligne] = await sql`
    SELECT 1 AS ok FROM tirages
    WHERE id = ${tirageId} AND participant_id = ${session.participantId}
  `;
  return [(ligne as { ok: boolean } | undefined) ?? null];
}
