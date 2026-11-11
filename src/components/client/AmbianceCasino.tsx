"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Music2, Music4 } from "lucide-react";

import {
  abonnerAmbiance,
  basculerAmbiance,
  demarrerAmbiance,
  estAmbianceCoupee,
} from "@/lib/sons";

/**
 * Musique de fond + bouton pour la couper.
 *
 * Deux contraintes dictent tout le composant :
 *
 *  1. AUCUN navigateur (iOS, Android, Chrome desktop) ne démarre l'audio avant
 *     une interaction. On écoute donc le PREMIER geste — toucher, clic, touche
 *     clavier — et on lance la boucle à cet instant. Sans ce déverrouillage,
 *     la musique ne jouerait jamais sur un poste de boutique où personne ne
 *     clique « dans le vide ».
 *  2. Un fond sonore qui ne peut pas s'arrêter est une nuisance derrière un
 *     comptoir : une pastille discrète en bas de l'écran coupe/relance, et le
 *     choix est mémorisé (localStorage).
 *
 * L'état vit dans localStorage : il est lu par `useSyncExternalStore`, avec un
 * instantané serveur neutre (`false`). Le HTML prérendu est donc le même pour
 * tout le monde — pas d'erreur d'hydratation, pas de `setState` dans un effet.
 */
export function AmbianceCasino() {
  const coupee = useSyncExternalStore(
    abonnerAmbiance,
    estAmbianceCoupee,
    () => false, // rendu serveur : musique annoncée active
  );

  useEffect(() => {
    const reveiller = () => {
      demarrerAmbiance();
      window.removeEventListener("pointerdown", reveiller);
      window.removeEventListener("keydown", reveiller);
    };
    window.addEventListener("pointerdown", reveiller, { once: true });
    window.addEventListener("keydown", reveiller, { once: true });
    return () => {
      window.removeEventListener("pointerdown", reveiller);
      window.removeEventListener("keydown", reveiller);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => basculerAmbiance()}
      aria-label={coupee ? "Activer la musique de fond" : "Couper la musique de fond"}
      aria-pressed={!coupee}
      title={coupee ? "Activer la musique" : "Couper la musique"}
      className="fixed right-2 bottom-2 z-40 flex size-9 items-center justify-center rounded-full border border-or/25 bg-black/35 text-or-clair/80 backdrop-blur-sm transition-colors hover:border-or/60 hover:text-or-clair"
    >
      {coupee ? <Music4 className="size-4" /> : <Music2 className="size-4" />}
    </button>
  );
}
