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

  /*
    Un seul QR désormais : il pointe vers la roue elle-même. Le jeu se joue
    sur le poste de la boutique, donc il n'y a plus de source de trafic à
    distinguer (ni comptoir, ni vitrine, ni Facebook) — le client est déjà là.
  */
  const modeles = [
    { cle: "roue", titre: "Roue — affiche boutique", url: `${base}/roue` },
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
          À imprimer en A5 ou A4 et à poser près du poste de jeu. Le client scanne, la roue
          s&apos;ouvre sur son téléphone — ou il joue directement sur l&apos;ordinateur de la boutique.
        </p>
      </header>

      <GenerateurQr qrCodes={qrCodes} baseUrl={base} />
    </div>
  );
}
