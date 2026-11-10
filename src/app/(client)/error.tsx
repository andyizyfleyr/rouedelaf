"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

import { Carte, TitreOr } from "@/components/ui/Base";

/**
 * Frontière d'erreur du parcours client.
 * Message en français simple, sans détail technique : le client en boutique
 * n'a pas à voir une trace serveur.
 */
export default function ErreurClient({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[client] erreur de page", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col justify-center gap-4 py-8">
      <Carte className="text-center">
        <TriangleAlert className="mx-auto mb-3 size-10 text-amber-300" />
        <TitreOr as="h1" className="text-xl">
          Petit souci technique
        </TitreOr>
        <p className="mt-2 text-[13px] leading-relaxed text-cendre">
          La roue n&apos;a pas pu s&apos;afficher. Appuyez sur le bouton pour réessayer.
        </p>
        <button type="button" onClick={reset} className="btn-or mt-5 w-full">
          <RefreshCw className="size-4" /> Réessayer
        </button>
        <a href="/roue" className="btn-fantome mt-2 w-full text-[12.5px]">
          Revenir à la roue
        </a>
      </Carte>
    </div>
  );
}
