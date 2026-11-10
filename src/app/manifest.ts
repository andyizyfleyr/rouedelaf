import type { MetadataRoute } from "next";

import { boutique } from "@/lib/env";

/**
 * Manifeste PWA : application installable sur l'écran d'accueil du téléphone
 * du client (Android : bannière automatique, iOS : « Sur l'écran d'accueil »).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${boutique.nom} — Roue de la Fortune`,
    short_name: "La Roue",
    description:
      "Tournez la roue et gagnez des cadeaux à retirer en boutique.",
    start_url: "/jouer",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0908",
    theme_color: "#0a0908",
    lang: "fr",
    categories: ["shopping", "games", "entertainment"],
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icones/icone-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Jouer", short_name: "Jouer", url: "/jouer" },
      { name: "Ma roue", short_name: "Roue", url: "/roue" },
    ],
  };
}
