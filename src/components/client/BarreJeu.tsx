"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Flocon, Guirlande, Houx, Sapin } from "@/components/client/Ornements";

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
    <div className="pt-1.5">
      {/* Guirlande : le seul ornement toujours en haut, quelle que soit la page. */}
      <Guirlande className="h-3" />
      <header className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <PastilleRoue />
          <div className="leading-tight">
            <p className="font-titre text-[12px] font-semibold tracking-[0.14em] text-or-clair uppercase">
              {nom}
            </p>
            <p className="flex items-center gap-1 text-[9px] tracking-[0.2em] text-givre/70 uppercase">
              <Sapin className="size-2.5" />
              Roue de Noël
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-givre/30 bg-sapin-3/40 px-2 py-0.5 text-[9px] tracking-[0.16em] text-givre/80 uppercase">
          <Houx className="size-2.5" />
          Bénin
        </span>
      </header>
    </div>
  );
}

/** Pied de page, masqué sur /roue. */
export function PiedJeu({ texte }: { texte: string }) {
  const chemin = usePathname();
  if (chemin === "/roue") return null;
  return (
    <footer className="mt-3 flex items-center justify-center gap-1.5 text-center text-[10px] leading-snug text-cendre/45">
      <Flocon className="size-2.5 shrink-0" />
      {texte}
    </footer>
  );
}

/** Mini roue décorative (pur CSS, aucun JS). */
function PastilleRoue() {
  return (
    <span
      aria-hidden
      className="animate-scintille block size-7 rounded-full border border-or-clair/70 shadow-[0_0_18px_-4px_rgba(212,175,55,0.9)]"
      style={{
        background:
          "conic-gradient(#d4af37 0 45deg, #b3122b 45deg 90deg, #0b5d3b 90deg 135deg, #d4af37 135deg 180deg, #b3122b 180deg 225deg, #0b5d3b 225deg 270deg, #d4af37 270deg 315deg, #0b5d3b 315deg 360deg)",
      }}
    />
  );
}

/**
 * Cadre des pages client : la largeur s'adapte à la page.
 *
 *  - /roue : jusqu'à 1280 px. La roue se dimensionne sur la hauteur de
 *    l'écran et a besoin de place ; la colonne de texte reste lisible.
 *  - ailleurs (inscription, résultat) : 480 px, la colonne « téléphone »
 *    qui va bien à un formulaire.
 */
export function CadreJeu({
  nom,
  pied,
  children,
}: {
  nom: string;
  pied: string;
  children: ReactNode;
}) {
  const chemin = usePathname();
  const large = chemin === "/roue";

  return (
    <div
      className={`relative mx-auto flex h-dvh w-full flex-col ${large ? "" : "pb-2"} ${
        // PLEINE LARGEUR ET SANS DÉFILEMENT sur /roue : le halo lumineux de la
        // roue dépasse volontairement de son carré (12 %) et, sans cela,
        // allongeait la page d'une soixantaine de pixels sur grand écran.
        // L'inscription garde le défilement (formulaires longs sur mobile).
        large
          ? "max-w-[1280px] overflow-hidden px-0 sm:px-6"
          : "max-w-[480px] px-3.5"
      }`}
    >
      <BarreJeu nom={nom} />
      {/*
        /roue : le `main` ne doit RIEN imposer. Il portait `flex-col` +
        `justify-center`, ce qui laissait la roue collée en haut sur téléphone.
        On lui demande seulement d'occuper l'espace restant ; c'est l'écran de
        la roue qui se centre lui-même (absolute inset-0).
      */}
      <main
        className={
          large
            ? "relative flex min-h-0 flex-1"
            : "flex min-h-0 flex-1 flex-col justify-center"
        }
      >
        {children}
      </main>
      <PiedJeu texte={pied} />
    </div>
  );
}
