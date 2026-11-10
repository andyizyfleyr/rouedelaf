import type { ReactNode } from "react";

import { boutique } from "@/lib/env";

/**
 * Gabarit des pages client : centré, mobile d'abord, avec un en-tête discret.
 * Le fond « velours » est fourni par le layout racine.
 */
export default function LayoutClient({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-4 pb-8">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2.5">
          <PastilleRoue />
          <div className="leading-tight">
            <p className="font-titre text-[13px] font-semibold tracking-[0.16em] text-or-clair uppercase">
              {boutique.nom}
            </p>
            <p className="text-[10px] tracking-[0.22em] text-cendre/70 uppercase">
              Roue de la fortune
            </p>
          </div>
        </div>
        <span className="rounded-full border border-or/25 px-2.5 py-1 text-[10px] tracking-[0.18em] text-cendre/80 uppercase">
          Bénin
        </span>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <footer className="mt-6 text-center text-[11px] leading-relaxed text-cendre/55">
        <p>{boutique.adresse}</p>
        <p className="mt-1">Un cadeau par personne · Retrait en boutique uniquement</p>
      </footer>
    </div>
  );
}

/** Mini roue décorative (pur CSS, aucun JS). */
function PastilleRoue() {
  return (
    <span
      aria-hidden
      className="animate-scintille block size-9 rounded-full border border-or-clair/70 shadow-[0_0_22px_-4px_rgba(232,198,106,0.85)]"
      style={{
        background:
          "conic-gradient(#e8c66a 0 45deg, #7c1d2e 45deg 90deg, #e8c66a 90deg 135deg, #1f6f5c 135deg 180deg, #e8c66a 180deg 225deg, #7c1d2e 225deg 270deg, #e8c66a 270deg 315deg, #1f6f5c 315deg 360deg)",
      }}
    />
  );
}
