"use client";

import { usePathname } from "next/navigation";

/**
 * En-tête des pages client.
 *
 * Sur /roue, la roue doit occuper TOUT l'écran : l'en-tête est alors réduit à
 * une seule ligne très fine (ou masqué) et le pied de page disparaît. Ailleurs
 * (inscription), il garde sa forme complète.
 *
 * Pourquoi un composant client ? Le layout est rendu une seule fois pour toutes
 * les pages du groupe : sans `usePathname`, la roue hériterait de l'en-tête
 * complet et perdrait 70 px de hauteur utile.
 */
export function BarreJeu({ nom }: { nom: string }) {
  const chemin = usePathname();
  const enJeu = chemin === "/roue";

  // /roue : pas d'en-tête du tout, la roue prend la place.
  if (enJeu) return null;

  return (
    <header className="flex items-center justify-between py-3">
      <div className="flex items-center gap-2.5">
        <PastilleRoue />
        <div className="leading-tight">
          <p className="font-titre text-[12px] font-semibold tracking-[0.14em] text-or-clair uppercase">
            {nom}
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
  );
}

/** Pied de page, masqué sur /roue. */
export function PiedJeu({ texte }: { texte: string }) {
  const chemin = usePathname();
  if (chemin === "/roue") return null;
  return (
    <footer className="mt-4 text-center text-[10px] leading-snug text-cendre/40">{texte}</footer>
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
