import type { Metadata, Viewport } from "next";

import { Pixels } from "@/components/marketing/Pixels";
import { EnregistrerServiceWorker } from "@/components/pwa/ServiceWorker";
import { boutique } from "@/lib/env";

import "./globals.css";

/**
 * Métadonnées statiques (nom de secours, variable d'environnement).
 * Le nom réglé dans l'admin est appliqué, lui, par <TitreBoutique /> côté
 * client : `generateMetadata` qui lit la base bloquerait le prérendu
 * (erreur « metadata is blocked » avec cacheComponents).
 */
export const metadata: Metadata = {
  title: {
    default: `${boutique.nom} — Roue de Noël`,
    template: `%s · ${boutique.nom}`,
  },
  description:
    "La roue de Noël : tournez, gagnez un cadeau et retirez-le en boutique. Une participation par numéro WhatsApp.",
  applicationName: "Roue de Noël",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Roue de Noël",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: `${boutique.nom} — Roue de Noël`,
    description: "Tournez la roue de Noël, gagnez un cadeau, passez en boutique !",
    type: "website",
    locale: "fr_BJ",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b2018",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="fond-velours min-h-dvh overflow-x-hidden">
        {children}
        <Pixels />
        <EnregistrerServiceWorker />
      </body>
    </html>
  );
}
