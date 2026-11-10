"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Gift,
  Menu,
  MonitorPlay,
  QrCode,
  X,
  LogOut,
  Settings2,
  QrCode as QrIcone,
} from "lucide-react";

import { cn } from "@/lib/cn";

const LIENS = [
  { href: "/admin", libelle: "Tableau de bord", icone: BarChart3 },
  { href: "/admin/cadeaux", libelle: "Cadeaux", icone: Gift },
  { href: "/admin/scan", libelle: "Scan remise", icone: QrCode },
  { href: "/admin/ecran", libelle: "Écran boutique", icone: MonitorPlay },
  { href: "/admin/qr", libelle: "QR à imprimer", icone: QrIcone },
  { href: "/admin/reglages", libelle: "Réglages", icone: Settings2 },
];

/** Barre de navigation de l'administration (responsive). */
export function BarreAdmin({ nomBoutique }: { nomBoutique: string }) {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);

  const liens = (
    <nav className="flex flex-col gap-1" aria-label="Navigation administration">
      {LIENS.map(({ href, libelle, icone: Icone }) => {
        const actif = href === "/admin" ? chemin === "/admin" : chemin.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOuvert(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors",
              actif
                ? "bg-or/15 text-or-clair shadow-[inset_2px_0_0_0_var(--color-or)]"
                : "text-cendre hover:bg-white/5 hover:text-creme",
            )}
          >
            <Icone className="size-4 shrink-0" />
            {libelle}
          </Link>
        );
      })}
      <form action="/api/admin/deconnexion" method="post" className="mt-3 border-t border-white/10 pt-3">
        <button
          type="submit"
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] text-cendre transition-colors hover:bg-bordeaux/30 hover:text-rose-200"
        >
          <LogOut className="size-4" /> Déconnexion
        </button>
      </form>
    </nav>
  );

  return (
    <>
      {/* Version mobile : barre supérieure + tiroir */}
      <header className="sticky top-0 z-40 border-b border-or/15 bg-[#0a0908]/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-3 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="text-lg">🎡</span>
            <span className="font-titre text-[13px] font-semibold tracking-[0.14em] text-or-clair uppercase">
              {nomBoutique}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOuvert((o) => !o)}
            aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={ouvert}
            className="rounded-lg border border-or/25 p-2 text-or-clair"
          >
            {ouvert ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
        {ouvert && <div className="px-2 pb-3">{liens}</div>}
      </header>

      {/* Version desktop : colonne latérale */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-or/12 bg-[#0b0a09] px-3 py-5 lg:flex">
        <Link href="/admin" className="mb-6 flex items-center gap-2.5 px-2">
          <span className="text-xl">🎡</span>
          <div>
            <p className="font-titre text-[13px] font-semibold tracking-[0.12em] text-or-clair uppercase">
              {nomBoutique}
            </p>
            <p className="text-[10px] tracking-[0.18em] text-cendre/60 uppercase">
              Administration
            </p>
          </div>
        </Link>
        {liens}
        <div className="mt-auto px-2 pt-4">
          <Link
            href="/roue"
            target="_blank"
            className="text-[11px] text-cendre/50 underline-offset-2 hover:text-or/80 hover:underline"
          >
            Ouvrir la roue ↗
          </Link>
        </div>
      </aside>

    </>
  );
}
