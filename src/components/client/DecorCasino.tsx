"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

/**
 * Décor de fond : la salle de casino (photo), posée derrière l'interface.
 *
 * Pourquoi une photo et non un aplat : l'or de la jante a besoin d'une lumière
 * chaude pour briller. La photo apporte les lustres et les bokeh dorés en haut,
 * le velours bordeaux sur les côtés, la table en bas — la roue se détache
 * comme un objet posé sur un meuble, au lieu de flotter sur un dégradé.
 *
 * Réglages retenus :
 *  - `object-cover` + `fixed` : un seul plan plein écran, jamais répété ;
 *  - voile sombre (`opacity`) par-dessus : la photo ne doit JAMAIS manger la
 *    lisibilité du texte ni des cases (testé sur la roue et sur l'admin) ;
 *  - `aria-hidden` + `pointer-events: none` : purement décoratif ;
 *  - la page admin garde son fond propre (les tables de données ont besoin de
 *    contraste, une photo derrière fatigue sur une journée de travail).
 */
export function DecorCasino() {
  const chemin = usePathname();
  if (chemin.startsWith("/admin")) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Image
        src="/decor/fond-casino.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center opacity-[0.85]"
      />
      {/* Voile : assombrit le centre (là où vit la roue) et les bords, pour que
          l'image reste une ambiance, pas un sujet de photo. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(52% 42% at 50% 48%, rgba(4,16,10,0.10) 0%, rgba(3,12,8,0.34) 58%, rgba(2,8,5,0.72) 100%), linear-gradient(180deg, rgba(3,12,8,0.10) 0%, rgba(3,12,8,0.04) 45%, rgba(2,8,5,0.45) 100%)",
        }}
      />
    </div>
  );
}
