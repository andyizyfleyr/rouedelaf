import type { Metadata, Viewport } from "next";

import { Pixels } from "@/components/marketing/Pixels";
import { EnregistrerServiceWorker } from "@/components/pwa/ServiceWorker";
import { boutique } from "@/lib/env";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${boutique.nom} — Roue de la Fortune`,
    template: `%s · ${boutique.nom}`,
  },
  description:
    "Tournez la roue et gagnez des cadeaux à retirer en boutique. Une participation par numéro WhatsApp.",
  applicationName: "Roue de la Fortune",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Roue de la Fortune",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: `${boutique.nom} — Roue de la Fortune`,
    description: "Tournez la roue, gagnez un cadeau, passez en boutique !",
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
  themeColor: "#0a0908",
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
