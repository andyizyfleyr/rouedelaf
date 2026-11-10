import QRCode from "qrcode";

import { GenerateurQr } from "@/components/admin/GenerateurQr";
import { TitreOr } from "@/components/ui/Base";
import { boutique } from "@/lib/env";

export const metadata = { title: "QR codes" };

/**
 * /admin/qr — QR codes à imprimer pour la boutique.
 *
 * Les QR sont générés CÔTÉ SERVEUR (lib `qrcode`) en PNG data-URL : ils
 * s'impriment net, sans dépendance JavaScript côté client, et le client n'a
 * qu'à scanner. Le paramètre `?src=` de chaque QR permet de mesurer l'origine
 * des joueurs (boutique, flyer, vitrine, Facebook…).
 */
export default async function PageQr() {
  const base = boutique.appUrl;

  const modeles = [
    { cle: "boutique", titre: "Comptoir / entrée boutique", url: `${base}/jouer?src=boutique` },
    { cle: "vitrine", titre: "Affiche vitrine", url: `${base}/jouer?src=vitrine` },
    { cle: "facebook", titre: "Publication Facebook", url: `${base}/jouer?src=facebook` },
    { cle: "tiktok", titre: "Vidéo TikTok", url: `${base}/jouer?src=tiktok` },
    { cle: "whatsapp", titre: "Statut / groupe WhatsApp", url: `${base}/jouer?src=whatsapp` },
  ];

  const qrCodes = await Promise.all(
    modeles.map(async (modele) => ({
      ...modele,
      image: await QRCode.toDataURL(modele.url, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 640,
        color: { dark: "#0a0908", light: "#ffffff" },
      }),
    })),
  );

  return (
    <div className="py-5">
      <header className="mb-4">
        <p className="text-[11px] tracking-[0.2em] text-or/70 uppercase">Impression</p>
        <TitreOr as="h1" className="mt-1 text-2xl sm:text-3xl">
          QR codes de la boutique
        </TitreOr>
        <p className="mt-2 max-w-[70ch] text-[12.5px] leading-relaxed text-cendre/75">
          Chaque QR code porte une source différente : vous saurez dans le tableau de bord si le
          joueur vient du comptoir, de la vitrine ou d&apos;une publicité. Téléchargez le PNG pour
          l&apos;imprimer en A5 ou A4.
        </p>
      </header>

      <GenerateurQr qrCodes={qrCodes} baseUrl={base} />
    </div>
  );
}
