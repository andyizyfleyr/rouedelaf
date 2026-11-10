"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Maximize2, QrCode, Sparkles, WifiOff } from "lucide-react";

import { formatDateHeure, formatNombre } from "@/lib/format";
import type { FluxBorne } from "@/lib/types";

/**
 * Écran borne (tablette / TV en boutique).
 *
 * - Très grand QR code pour scanner depuis son téléphone.
 * - Bandeau des derniers gagnants alimenté par /api/borne (public, limité aux
 *   prénoms : aucune donnée personnelle sensible n'est exposée).
 * - Bouton plein écran pour la mise en service par la vendeuse.
 * - Horloge locale (Africa/Porto-Novo) : les clients voient l'heure de la
 *   boutique.
 */
export function EcranBorne({
  qr,
  url,
  nomBoutique,
  adresse,
  initial,
}: {
  qr: string;
  url: string;
  nomBoutique: string;
  adresse: string;
  /** Premier état lu côté serveur : la borne affiche les vrais chiffres d'emblée. */
  initial: FluxBorne | null;
}) {
  const [flux, setFlux] = useState<FluxBorne | null>(initial);
  // Si le rendu serveur n'a pas pu lire la base, on part « hors ligne » et le
  // premier appel réseau rétablira l'état.
  const [connecte, setConnecte] = useState(initial !== null);
  const [index, setIndex] = useState(0);
  const [heure, setHeure] = useState("");

  // Données des derniers gagnants (route publique, données minimales).
  useEffect(() => {
    let vivant = true;

    const charger = async () => {
      try {
        const res = await fetch("/api/borne", { cache: "no-store" });
        if (!res.ok) throw new Error("http");
        const data = (await res.json()) as FluxBorne;
        if (vivant) {
          setFlux(data);
          setConnecte(true);
        }
      } catch {
        if (vivant) setConnecte(false);
      }
    };

    const premier = setTimeout(charger, 0);
    const id = setInterval(charger, 15_000);
    return () => {
      vivant = false;
      clearTimeout(premier);
      clearInterval(id);
    };
  }, []);

  // Rotation du bandeau des gagnants (4 s par gagnant).
  useEffect(() => {
    const nombre = flux?.gagnants.length ?? 0;
    if (nombre <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % nombre), 4000);
    return () => clearInterval(id);
  }, [flux]);

  // Horloge de la boutique.
  useEffect(() => {
    const tic = () => {
      setHeure(
        new Intl.DateTimeFormat("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Africa/Porto-Novo",
        }).format(new Date()),
      );
    };
    const premier = setTimeout(tic, 0);
    const id = setInterval(tic, 15_000);
    return () => {
      clearTimeout(premier);
      clearInterval(id);
    };
  }, []);

  const gagnant = flux?.gagnants[index];

  async function pleinEcran() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      /* refusé par le navigateur : non bloquant */
    }
  }

  return (
    <div className="fond-velours relative flex min-h-dvh flex-col overflow-hidden px-5 pb-6 pt-5 sm:px-10">
      {/* Halos */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-25%] size-[80vw] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(232,198,106,0.18),transparent_62%)] blur-3xl" />
        <div className="absolute bottom-[-15%] left-[-10%] size-[45vw] rounded-full bg-[radial-gradient(circle,rgba(124,29,46,0.25),transparent_65%)] blur-3xl" />
      </div>

      {/* Barre haute */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full border border-or/40 bg-or/10 text-lg">
            🎡
          </span>
          <div>
            <p className="font-titre text-sm font-semibold tracking-[0.16em] text-or-clair uppercase sm:text-base">
              {nomBoutique}
            </p>
            <p className="text-[10px] tracking-[0.22em] text-cendre/55 uppercase sm:text-[11px]">
              {adresse}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-titre text-xl tabular-nums text-creme sm:text-2xl">{heure}</span>
          <button
            type="button"
            onClick={pleinEcran}
            className="rounded-full border border-or/25 p-2 text-or/80"
            aria-label="Plein écran"
          >
            <Maximize2 className="size-4" />
          </button>
        </div>
      </header>

      {/* Cœur : QR + gagnants */}
      <main className="mt-6 flex flex-1 flex-col items-center justify-center gap-8 lg:flex-row lg:items-stretch lg:gap-10">
        {/* QR */}
        <motion.section
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center"
        >
          <p className="mb-1 text-center font-titre text-[10px] tracking-[0.32em] text-or/75 uppercase">
            Scannez · Tournez · Gagnez
          </p>
          <h1 className="texte-or-anime mb-5 max-w-[22ch] text-center font-titre text-[2rem] leading-[1.05] font-bold tracking-tight uppercase sm:text-[2.6rem] lg:text-[2.2rem]">
            La roue de la fortune
          </h1>

          <div className="rounded-[2rem] border border-or/30 bg-or-clair p-3 shadow-[0_0_80px_-20px_rgba(232,198,106,0.85)] sm:p-4">
            {/* QR généré côté serveur */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt="QR code pour jouer"
              className="size-[min(58vw,320px)] rounded-2xl lg:size-[340px]"
            />
          </div>

          <p className="mt-5 flex items-center gap-2 text-center text-[12px] tracking-wide text-cendre sm:text-[13px]">
            <QrCode className="size-4 text-or" />
            Ouvrez l&apos;appareil photo de votre téléphone
          </p>
          <p className="mt-1 max-w-[34ch] text-center text-[11px] leading-relaxed text-cendre/55">
            Tentez votre chance : des dizaines de lots vous attendent.
          </p>

          <p className="mt-3 truncate font-mono text-[10px] text-cendre/35">{url}</p>
        </motion.section>

        {/* Derniers gagnants */}
        <section className="w-full max-w-md flex-1 rounded-3xl border border-or/15 bg-black/25 p-4 backdrop-blur-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-titre text-[12px] font-semibold tracking-[0.16em] text-or-clair uppercase">
              <Sparkles className="size-4" /> Ils ont gagné
            </h2>
            {!connecte && (
              <span className="flex items-center gap-1 text-[10px] text-amber-200/80">
                <WifiOff className="size-3" /> hors ligne
              </span>
            )}
          </div>

          <div className="relative h-40 sm:h-48">
            <AnimatePresence mode="wait">
              {gagnant ? (
                <motion.div
                  key={gagnant.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.35 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center"
                >
                  <span
                    className="flex size-14 items-center justify-center rounded-full text-xl font-bold text-black/75"
                    style={{ backgroundColor: gagnant.couleur ?? "#e8c66a" }}
                    aria-hidden
                  >
                    🎁
                  </span>
                  <p className="mt-2 font-titre text-lg font-semibold text-creme">
                    {gagnant.cadeau_nom ?? "Cadeau"}
                  </p>
                  <p className="mt-1 text-[10px] tracking-[0.16em] text-cendre/45 uppercase">
                    {formatDateHeure(gagnant.created_at)}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="vide"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center"
                >
                  <p className="text-3xl">🎁</p>
                  <p className="mt-2 font-titre text-base text-or-clair">Soyez le premier !</p>
                  <p className="max-w-[26ch] text-[11.5px] leading-relaxed text-cendre/60">
                    Scannez le QR code et tentez de gagner un cadeau tout de suite.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Puces de pagination */}
          {flux && flux.gagnants.length > 1 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {flux.gagnants.slice(0, 10).map((g, i) => (
                <span
                  key={g.id}
                  className={`size-1.5 rounded-full transition-colors ${
                    i === index ? "bg-or" : "bg-white/15"
                  }`}
                />
              ))}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/8 pt-3 text-center">
            <div>
              <p className="font-titre text-xl font-bold text-creme">
                {formatNombre(flux?.totaux.tirages ?? 0)}
              </p>
              <p className="text-[9.5px] tracking-[0.14em] text-cendre/50 uppercase">Tirages</p>
            </div>
            <div>
              <p className="font-titre text-xl font-bold text-or-clair">
                {formatNombre(flux?.totaux.gagnes ?? 0)}
              </p>
              <p className="text-[9.5px] tracking-[0.14em] text-cendre/50 uppercase">
                Cadeaux gagnés
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-cendre/40">
        <span>Jeu en boutique · Cadeau à retirer sur place</span>
      </footer>
    </div>
  );
}

