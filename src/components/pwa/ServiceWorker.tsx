"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker (PWA) après le premier rendu.
 * En développement, le service worker est désactivé : il gênerait le
 * rechargement à chaud.
 */
export function EnregistrerServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const enregistrer = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => {
        console.warn("[pwa] enregistrement impossible", e);
      });
    };

    if (document.readyState === "complete") {
      enregistrer();
    } else {
      window.addEventListener("load", enregistrer, { once: true });
    }
  }, []);

  return null;
}
