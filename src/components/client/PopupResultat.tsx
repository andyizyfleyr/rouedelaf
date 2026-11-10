"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { IconeCadeau } from "@/components/roue/IconeCadeau";
import { arreterConfettis, lancerConfettis } from "@/lib/confettis";
import { suivreEvenement } from "@/lib/pixel";
import { jouerVictoire } from "@/lib/sons";
import type { ResultatTirageApi } from "@/lib/types";

/**
 * Résultat du tirage, en POPUP par-dessus la roue.
 *
 * Volontairement MINIMAL : un titre « Félicitations » et le cadeau affiché en
 * grand. Rien d'autre — ni code de retrait, ni QR, ni date d'expiration, ni
 * adresse de boutique, ni bouton de partage. Le client joue sur le poste de la
 * boutique, regarde son cadeau, ferme la popup, et c'est terminé.
 *
 * Pourquoi une popup et non une page ? La roue reste visible derrière : le
 * client voit où l'aiguille s'est arrêtée, puis on lui ferme la fenêtre. Il n'y
 * a aucune redirection, donc aucun retour en arrière à gérer.
 *
 * À la fermeture, l'écran de la roue oublie complètement ce tour (voir
 * `oublierLeTour` dans EcranRoue) : le client suivant peut jouer aussitôt.
 */
export function PopupResultat({
  resultat,
  ouvert,
  onFermer,
}: {
  resultat: ResultatTirageApi;
  ouvert: boolean;
  onFermer: () => void;
}) {
  const panneau = useRef<HTMLDivElement>(null);
  const gagne = resultat.statut === "gagne";
  const nom = resultat.cadeau?.nom ?? null;
  // Une case n'affiche jamais texte ET image : ici, même règle pour le cadeau.
  const image = resultat.cadeau?.image_url ?? null;

  // Confettis + son à l'OUVERTURE seulement, jamais au montage.
  useEffect(() => {
    if (!ouvert) return;
    if (gagne) {
      void lancerConfettis({ intense: true });
      jouerVictoire();
      suivreEvenement("joue_victoire", { cadeau: nom, valeur: 0 });
    }
  }, [ouvert, gagne, nom]);

  /**
   * Ouverture : Échap ferme, le fond ne défile plus, et le focus entre dans la
   * popup (sinon un lecteur d'écran reste sur <body> sans savoir qu'une
   * fenêtre s'est ouverte).
   *
   * Au démontage (popup fermée) : on efface les confettis. Sur le poste de la
   * boutique, ceux du client précédent tombaient encore derrière la roue quand
   * le suivant arrivait.
   */
  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onFermer();
        return;
      }
      // Piège à focus : Tab ne sort jamais du panneau.
      if (e.key === "Tab" && panneau.current) {
        const focusables = panneau.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const premier = focusables[0];
        const dernier = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === premier) {
          e.preventDefault();
          dernier.focus();
        } else if (!e.shiftKey && document.activeElement === dernier) {
          e.preventDefault();
          premier.focus();
        }
      }
    };
    window.addEventListener("keydown", surTouche);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = setTimeout(() => panneau.current?.focus(), 80);

    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", surTouche);
      document.body.style.overflow = avant;
      arreterConfettis();
    };
  }, [ouvert, onFermer]);

  return (
    <AnimatePresence>
      {ouvert && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Voile sombre : la roue reste devinée derrière */}
          <button
            type="button"
            aria-label="Fermer le résultat"
            onClick={onFermer}
            className="absolute inset-0 bg-black/75 backdrop-blur-[3px]"
          />

          <motion.div
            ref={panneau}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={gagne ? "Votre cadeau" : "Votre résultat"}
            initial={{ scale: 0.86, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="carte-luxe relative z-10 w-full max-w-[min(92vw,30rem)] overflow-hidden !p-5 text-center outline-none"
          >
            {/* Guirlande de Noël : le résultat tombe « sous les lumières ». */}
            <div className="mx-auto mb-3 flex items-center justify-center gap-1" aria-hidden>
              {Array.from({ length: 11 }, (_, i) => (
                <span
                  key={i}
                  className="animate-scintille size-1 rounded-full"
                  style={{
                    background: i % 2 === 0 ? "#f5d77a" : "#d93a4a",
                    boxShadow: `0 0 6px ${i % 2 === 0 ? "rgba(245,215,122,0.8)" : "rgba(217,58,74,0.65)"}`,
                    animationDelay: `${(i % 4) * 0.3}s`,
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={onFermer}
              aria-label="Fermer"
              className="absolute top-2.5 right-2.5 grid size-9 place-items-center rounded-full border border-white/10 bg-black/40 text-cendre/70 transition-colors hover:text-creme"
            >
              <X className="size-4" />
            </button>

            {/* LE TITRE, rien d'autre */}
            <h2 className="texte-or font-titre text-[1.75rem] leading-tight font-bold uppercase sm:text-[2.1rem]">
              {gagne ? "Félicitations" : "Pas de chance"}
            </h2>

            {/* LE CADEAU, EN GRAND */}
            {gagne ? (
              <div className="mt-4 flex flex-col items-center gap-3">
                <motion.div
                  initial={{ scale: 0.7, rotate: -6, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
                  className="relative grid aspect-square w-full max-w-[15rem] place-items-center overflow-hidden rounded-2xl border border-or/40 bg-black/30 shadow-[0_0_60px_-18px_rgba(232,198,106,0.85)]"
                >
                  {image ? (
                    <Image
                      src={image}
                      alt={nom ?? "Cadeau"}
                      fill
                      sizes="(max-width: 640px) 60vw, 240px"
                      className="object-cover"
                    />
                  ) : (
                    <IconeCadeau nom={nom ?? "Cadeau"} taille={104} couleur="rgba(232,198,106,0.95)" />
                  )}
                </motion.div>

                <p className="font-titre text-[1.5rem] leading-tight font-bold text-creme sm:text-[1.8rem]">
                  {nom ?? "Cadeau surprise"}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-[13.5px] leading-relaxed text-cendre/85">
                Pas de cadeau cette fois. Tentez votre chance à nouveau au prochain passage.
              </p>
            )}

            {/* Fermer : la roue redevient jouable immédiatement pour le suivant */}
            <button
              type="button"
              onClick={onFermer}
              className="btn-or mt-5 w-full !py-3 text-[15px]"
            >
              {gagne ? "Récupérer mon cadeau en boutique" : "Fermer"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
