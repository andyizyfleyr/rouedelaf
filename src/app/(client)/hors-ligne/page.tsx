import { WifiOff } from "lucide-react";

import { Carte, TitreOr } from "@/components/ui/Base";

export const metadata = { title: "Hors connexion" };

/** Page de secours servie par le service worker quand le réseau est coupé. */
export default function PageHorsLigne() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      <Carte className="text-center">
        <WifiOff className="mx-auto mb-3 size-10 text-or/70" />
        <TitreOr as="h1" className="text-xl">
          Pas de connexion
        </TitreOr>
        <p className="mt-2 text-[13px] leading-relaxed text-cendre">
          Votre connexion est coupée. Reconnectez-vous puis appuyez sur « Réessayer » pour
          tourner la roue.
        </p>
        <a href="/roue" className="btn-or mt-5 w-full">
          Réessayer
        </a>
      </Carte>
    </div>
  );
}
