import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Suspense } from "react";

import { EcranResultat } from "@/components/client/EcranResultat";
import { boutique } from "@/lib/env";
import { lireSessionJeu } from "@/lib/session";
import { listeTiragesParticipant, tirageParId } from "@/server/data";
import { lireParametres } from "@/server/params";

export const metadata = {
  title: "Votre résultat",
  description: "Découvrez votre cadeau et votre code de retrait.",
};

/**
 * /resultat?t=ID — écran de fin.
 *
 * Trois usages :
 *  1. `?t=ID` : un cadeau précis (lien « Plein écran » de la popup).
 *  2. sans paramètre : TOUS les cadeaux du joueur, du plus récent au plus
 *     ancien. Avant, seul le dernier était affiché : dès qu'un joueur gagnait
 *     deux lots (parrainage), le premier bon devenait inaccessible alors
 *     qu'il restait valable en boutique.
 *  3. filet de sécurité si le JavaScript est coupé.
 *
 * Le QR code est généré CÔTÉ SERVEUR : il reste utilisable sans JS.
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
  const parametres = await lireParametres();

  if (Number.isFinite(idDemande)) {
    const tirage = await tirageParId(idDemande);
    // Sécurité : un joueur ne voit que SES tirages.
    if (!tirage || !(await estProprietaire(tirage.id, session.participantId))) redirect("/roue");

    const qrDataUrl = tirage.statut === "gagne" && tirage.code_unique
      ? await qr(tirage.code_unique)
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

  const tirages = await listeTiragesParticipant(session.participantId);
  if (tirages.length === 0) redirect("/roue");

  // Un QR par gain : le joueur doit pouvoir présenter n'importe lequel.
  const entrees = await Promise.all(
    tirages.map(async (tirage) => ({
      tirage,
      qrDataUrl:
        tirage.statut === "gagne" && tirage.code_unique ? await qr(tirage.code_unique) : null,
    })),
  );

  return (
    <div className="flex flex-col gap-3">
      {tirages.length > 1 && (
        <p className="text-center text-[11px] tracking-[0.16em] text-cendre/60 uppercase">
          {tirages.length} cadeaux gagnés
        </p>
      )}
      {entrees.map(({ tirage, qrDataUrl }, i) => (
        <EcranResultat
          key={tirage.id}
          tirage={tirage}
          qrDataUrl={qrDataUrl}
          messagePerdu={parametres.messagePerdu}
          boutique={{ nom: boutique.nom, adresse: boutique.adresse, whatsapp: boutique.whatsapp }}
          rang={{ position: i + 1, total: entrees.length }}
        />
      ))}
    </div>
  );
}

function qr(code: string): Promise<string> {
  return QRCode.toDataURL(code, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 420,
    color: { dark: "#0a0908", light: "#f8e7a8" },
  });
}

async function estProprietaire(tirageId: number, participantId: number): Promise<boolean> {
  const { sql } = await import("@/lib/db");
  const [ligne] = await sql`
    SELECT 1 AS ok FROM tirages
    WHERE id = ${tirageId} AND participant_id = ${participantId}
  `;
  return Boolean(ligne);
}
