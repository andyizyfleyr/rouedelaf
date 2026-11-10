import type { NextConfig } from "next";

/**
 * Configuration Next.js — Roue de la Fortune
 *
 * - `cacheComponents` + `partialPrefetching` : coquille statique instantanée
 *   (important sur un petit Android en 3G) et prefetch partiel des routes.
 * - `images.remotePatterns` : autorise les images de cadeaux hébergées
 *   (Vercel Blob ou tout autre CDN renseigné par l'admin).
 */
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  // Les fichiers SQL sont lus à l'exécution par /api/admin/init (initialisation
  // de la base depuis Vercel). Sans cette ligne, Vercel n'embarque que les
  // modules et `fs` ne trouverait pas sql/schema.sql dans la fonction.
  outputFileTracingIncludes: {
    "/api/admin/init": ["./sql/**/*.sql"],
  },

  // Les paquets serveur qui ne doivent jamais finir dans le bundle navigateur.
  serverExternalPackages: ["@neondatabase/serverless"],

  // Turbopack (Next 16) : Tailwind CSS v4 est compilé via le loader officiel.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  async headers() {
    return [
      {
        // Sécurité de base pour toutes les pages.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self)" },
        ],
      },
      {
        // Le service worker doit pouvoir contrôler toute l'application.
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
