import type { ReactNode } from "react";

import { boutique } from "@/lib/env";

/**
 * Gabarit des pages client : centré, mobile d'abord, avec un en-tête discret.
 * Le fond « velours » est fourni par le layout racine.
 */
export default function LayoutClient({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-3.5 pb-5">
      <header className="flex items-center justify-between py-3">
        <div className="flex items-center gap-2.5">
          <PastilleRoue />
          <div className="leading-tight">
            <p className="font-titre text-[12px] font-semibold tracking-[0.14em] text-or-clair uppercase">
              {boutique.nom}
            </p>
            <p className="text-[9px] tracking-[0.2em] text-cendre/60 uppercase">
              Roue de la fortune
            </p>
          </div>
        </div>
        <span className="rounded-full border border-or/25 px-2 py-0.5 text-[9px] tracking-[0.16em] text-cendre/70 uppercase">
          Bénin
        </span>
      </header>

      <main className="flex flex-1 flex-col justify-center">{children}</main>

      <footer className="mt-4 text-center text-[10px] leading-snug text-cendre/40">
        {boutique.adresse} · Un cadeau par personne
      </footer>
    </div>
  );
}

/** Mini roue décorative (pur CSS, aucun JS). */
function PastilleRoue() {
  return (
    <span
      aria-hidden
      className="animate-scintille block size-7 rounded-full border border-or-clair/70 shadow-[0_0_18px_-4px_rgba(232,198,106,0.85)]"
      style={{
        background:
          "conic-gradient(#e8c66a 0 45deg, #7c1d2e 45deg 90deg, #e8c66a 90deg 135deg, #1f6f5c 135deg 180deg, #e8c66a 180deg 225deg, #7c1d2e 225deg 270deg, #e8c66a 270deg 315deg, #1f6f5c 315deg 360deg)",
      }}
    />
  );
}
