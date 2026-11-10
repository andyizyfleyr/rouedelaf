import QRCode from "qrcode";
import { EcranBorne } from "@/components/client/EcranBorne";
import { boutique } from "@/lib/env";
import { lireIdentite } from "@/lib/identite";
import { fluxBorne } from "@/server/data";

export const metadata = { title: "Borne d'accueil" };

/**
 * La borne lit `?src=` et génère un QR propre à ce domaine : elle est rendue
 * à la demande (aucun contenu statique à prérendre). Coût : une génération de
 * QR par chargement, négligeable sur une tablette qui ne recharge jamais.
 */
export const instant = false;

/**
 * /borne — MODE BORNE (tablette posée en boutique).
 *
 * Écran d'accueil plein cadre destiné à une tablette ou une TV :
 *  - un très grand QR code : le client le scanne et joue sur SON téléphone
 *    (son propre numéro WhatsApp et son propre consentement — la tablette
 *    ne collecte rien) ;
 *  - un bandeau des derniers gagnants qui tourne en boucle pour créer
 *    l'envie ;
 *  - aucune interaction avec la tablette : elle ne collecte aucune donnée.
 *
 * Pourquoi pas jouer directement sur la tablette ? Parce que le jeu se joue
 * sur le poste de la boutique, accompagné par la vendeuse. La borne attire
 * l'œil et affiche les derniers cadeaux gagnés ; elle ne collecte rien.
 *
 * Le QR est rendu côté serveur : il reste net même sur un écran 4K.
 */
export default async function PageBorne() {
  const identite = await lireIdentite();
  const url = `${boutique.appUrl}/roue`;

  const qr = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 900,
    color: { dark: "#0a0908", light: "#f8e7a8" },
  });

  // Chiffres et derniers gagnants lus dès le rendu serveur : la tablette ne
  // montre jamais « 0 joueur » en attendant le premier appel réseau.
  let initial = null;
  try {
    initial = await fluxBorne();
  } catch (e) {
    // Base indisponible : la borne reste utilisable (QR + message d'attente)
    // et le composant client retentera dans 15 s.
    console.error("[borne] flux initial indisponible", e);
  }

  return (
    <EcranBorne
      qr={qr}
      url={url}
      nomBoutique={identite.nom}
      adresse={identite.adresse}
      initial={initial}
    />
  );
}
