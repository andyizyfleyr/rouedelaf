"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Gift, Radio, RefreshCw, Trophy, Users } from "lucide-react";

import { Pastille } from "@/components/ui/Base";
import { formatNombre } from "@/lib/format";


/**
 * Écran boutique (TV/tablette) : derniers gagnants en direct.
 *
 * Fonctionnement : polling toutes les 8 s de /api/admin/ecran (une seule
 * requête SQL indexée). Les nouveaux gagnants apparaissent en haut avec une
 * animation, ce qui attire l'œil des clients présents dans la boutique.
 *
 * Realtime natif : si vous branchez plus tard Supabase Realtime, remplacez
 * simplement `useEffect` de polling par un `subscribe()` — le reste du
 * composant ne change pas.
 */
type Gagnant = {
  id: number;
  nom: string;
  telephone_aff: string | null;
  cadeau_nom: string | null;
  couleur: string | null;
  created_at: string;
};

type Flux = {
  gagnants: Gagnant[];
  totaux: { joueurs: number; gagnes: number; recuperes: number };
  horodatage: string;
};

const INTERVALLE_MS = 8_000;

export function EcranBoutique({ modeHtml }: { modeHtml: boolean }) {
  const [flux, setFlux] = useState<Flux | null>(null);
  const [nouveaux, setNouveaux] = useState<Set<number>>(new Set());
  const [connecte, setConnecte] = useState(true);
  const [pleinEcran, setPleinEcran] = useState(false);
  const dejaVus = useRef<Set<number>>(new Set());
  const conteneur = useRef<HTMLDivElement | null>(null);

  const charger = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ecran", { cache: "no-store" });
      if (!res.ok) {
        setConnecte(false);
        return;
      }
      const data = (await res.json()) as Flux;
      setConnecte(true);

      // Nouveaux gagnants depuis le dernier rafraîchissement.
      const recents = new Set<number>();
      for (const g of data.gagnants) {
        if (!dejaVus.current.has(g.id)) recents.add(g.id);
        dejaVus.current.add(g.id);
      }
      if (dejaVus.current.size > 0 && recents.size > 0 && flux) {
        setNouveaux(recents);
        setTimeout(() => setNouveaux(new Set()), 6000);
      }
      setFlux(data);
    } catch {
      setConnecte(false);
    }
  }, [flux]);

  /*
   * Le premier chargement est différé d'une microtâche : cela évite un
   * setState synchrone dans le corps de l'effet (cascade de rendus) tout en
   * lançant la requête immédiatement après le montage.
   */
  useEffect(() => {
    const premier = setTimeout(() => void charger(), 0);
    const id = setInterval(() => void charger(), INTERVALLE_MS);
    return () => {
      clearTimeout(premier);
      clearInterval(id);
    };
  }, [charger]);

  async function activerPleinEcran() {
    if (!conteneur.current) return;
    try {
      if (!document.fullscreenElement) {
        await conteneur.current.requestFullscreen();
        setPleinEcran(true);
      } else {
        await document.exitFullscreen();
        setPleinEcran(false);
      }
    } catch {
      /* certains navigateurs refusent : pas bloquant */
    }
  }

  return (
    <div
      ref={conteneur}
      className="relative -mx-3 flex min-h-[calc(100dvh-64px)] flex-col overflow-hidden px-4 py-5 sm:-mx-5 sm:px-8 lg:ml-60"
    >
      {/* Fond lumineux */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-20%] size-[70vw] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(232,198,106,0.16),transparent_65%)] blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] size-[45vw] rounded-full bg-[radial-gradient(circle,rgba(124,29,46,0.22),transparent_65%)] blur-3xl" />
      </div>

      {/* En-tête */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="animate-pouls-or flex size-12 items-center justify-center rounded-full border border-or/45 bg-or/10"
            aria-hidden
          >
            <Trophy className="size-6 text-or" />
          </span>
          <div>
            <h1 className="texte-or font-titre text-2xl font-bold tracking-[0.06em] uppercase sm:text-3xl">
              Gagnants du jour
            </h1>
            <p className="text-[11.5px] tracking-[0.18em] text-cendre/60 uppercase">
              Roue de la fortune · {process.env.NEXT_PUBLIC_BOUTIQUE_NOM ?? "Boutique"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Pastille ton={connecte ? "vert" : "rouge"}>
            <Radio className={`size-3 ${connecte ? "animate-pulse" : ""}`} />
            {connecte ? "En direct" : "Hors ligne"}
          </Pastille>
          <button
            type="button"
            onClick={activerPleinEcran}
            className="btn-fantome !px-3 !py-1.5 text-[11.5px]"
          >
            {pleinEcran ? "Quitter le plein écran" : "Plein écran"}
          </button>
        </div>
      </header>

      {/* Chiffres clés */}
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Chiffre icone={<Users className="size-4" />} libelle="Joueurs" valeur={formatNombre(flux?.totaux.joueurs ?? 0)} />
        <Chiffre icone={<Gift className="size-4" />} libelle="Cadeaux gagnés" valeur={formatNombre(flux?.totaux.gagnes ?? 0)} />
        <Chiffre
          icone={<Trophy className="size-4" />}
          libelle="Retirés en boutique"
          valeur={formatNombre(flux?.totaux.recuperes ?? 0)}
        />
      </div>

      {/* Liste des gagnants */}
      <div className="mt-4 flex-1">
        {!flux && (
          <div className="flex h-64 items-center justify-center">
            <RefreshCw className="size-6 animate-spin text-or/50" />
          </div>
        )}

        {flux && flux.gagnants.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <span className="text-5xl">🎡</span>
            <p className="font-titre text-xl text-or-clair">La roue vous attend !</p>
            <p className="max-w-[36ch] text-[13px] leading-relaxed text-cendre/70">
              Scannez le QR code à l&apos;entrée, tournez la roue et repartez peut-être avec un
              cadeau.
            </p>
          </div>
        )}

        <ul className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {flux?.gagnants.map((g, index) => (
              <motion.li
                key={g.id}
                layout
                initial={{ opacity: 0, y: -14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.35 }}
                className={`relative overflow-hidden rounded-2xl border p-3.5 ${
                  nouveaux.has(g.id)
                    ? "border-or/70 bg-or/12 shadow-[0_0_30px_-8px_rgba(232,198,106,0.7)]"
                    : "border-white/8 bg-white/[0.03]"
                }`}
              >
                {nouveaux.has(g.id) && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 1.8, repeat: 2 }}
                    className="absolute right-2.5 top-2.5 rounded-full bg-or px-2 py-0.5 text-[9px] font-bold tracking-wider text-black uppercase"
                  >
                    Nouveau
                  </motion.span>
                )}

                <div className="flex items-center gap-3">
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-black/75"
                    style={{ backgroundColor: g.couleur ?? "#e8c66a" }}
                    aria-hidden
                  >
                    {initiales(g.nom)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-titre text-[15px] font-semibold text-creme">
                      {g.nom}
                    </p>
                    <p className="truncate text-[12px] text-or/80">{g.cadeau_nom}</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] tracking-wide text-cendre/45 uppercase">
                  {heure(g.created_at)}
                </p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      <footer className="mt-4 flex items-center justify-between text-[10.5px] text-cendre/40">
        <span>Mise à jour automatique toutes les 8 secondes</span>
        <span className="flex items-center gap-1.5">
          <Image src="/icones/icone-192.png" alt="" width={14} height={14} className="rounded" />
          Roue de la fortune
        </span>
      </footer>

      {modeHtml && (
        <p className="mt-2 text-center text-[10px] text-cendre/35">
          Mode HTML (capture OBS) : ajoutez <code>?mode=html</code> dans l&apos;URL de la source.
        </p>
      )}
    </div>
  );
}

function Chiffre({ icone, libelle, valeur }: { icone: React.ReactNode; libelle: string; valeur: string }) {
  return (
    <div className="rounded-2xl border border-or/18 bg-black/30 px-3 py-2.5 backdrop-blur">
      <div className="flex items-center gap-1.5 text-or/75">
        {icone}
        <span className="text-[9.5px] tracking-[0.14em] uppercase">{libelle}</span>
      </div>
      <p className="mt-1 font-titre text-xl font-bold text-creme sm:text-2xl">{valeur}</p>
    </div>
  );
}

function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .slice(0, 2)
    .map((m) => m.charAt(0).toUpperCase())
    .join("");
}

function heure(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Porto-Novo",
  }).format(new Date(date));
}
