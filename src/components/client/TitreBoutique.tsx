"use client";

import { useEffect } from "react";

/**
 * Applique le nom de la boutique réglé dans l'admin au titre du navigateur.
 *
 * Le titre statique de `layout.tsx` porte le nom de secours (variable
 * d'environnement) : celui-ci le remplace dès que la valeur en base est
 * connue. Un `generateMetadata` qui lirait la base bloquerait le prérendu
 * avec `cacheComponents` — d'où ce passage par le client.
 */
export function TitreBoutique({ nom }: { nom: string }) {
  useEffect(() => {
    if (!nom) return;
    const actuel = document.title;
    // On ne remplace que le nom : « Roue · Ancien Nom » devient
    // « Roue · Nouveau Nom », sans casser le titre de la page courante.
    const motif = /^(.*?)\s*(?:·|—)\s*[^·—]+$/;
    const page = actuel.match(motif)?.[1];
    document.title = page && page !== actuel ? `${page} · ${nom}` : `${nom} — Roue de Noël`;
  }, [nom]);
  return null;
}
