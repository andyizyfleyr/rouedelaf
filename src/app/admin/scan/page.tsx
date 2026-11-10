import { ScannerCode } from "@/components/admin/ScannerCode";
import { TitreOr } from "@/components/ui/Base";

export const metadata = { title: "Scan remise" };

/**
 * /admin/scan — la vendeuse scanne le QR du client avec la caméra du téléphone
 * (ou saisit le code à la main) pour marquer le cadeau comme remis.
 */
export default function PageScan() {
  return (
    <div className="py-5">
      <header className="mb-4">
        <p className="text-[11px] tracking-[0.2em] text-or/70 uppercase">Comptoir</p>
        <TitreOr as="h1" className="mt-1 text-2xl sm:text-3xl">
          Scan remise de cadeau
        </TitreOr>
        <p className="mt-2 max-w-[65ch] text-[12.5px] leading-relaxed text-cendre/75">
          Scannez le QR code du client (page résultat). Vérifiez le cadeau affiché puis validez :
          la remise est enregistrée et le code ne pourra plus être utilisé. Un code expiré ou déjà
          remis est refusé.
        </p>
      </header>

      <ScannerCode />
    </div>
  );
}
