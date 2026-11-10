/* Service worker — Roue de la Fortune
 *
 * Stratégies :
 *  - Navigation : réseau d'abord, page hors-ligne en secours.
 *  - Statique (/_next/static, icônes, sons) : cache d'abord (immutable).
 *  - API : jamais de cache (les tirages doivent toujours être frais).
 */

const VERSION = "roue-v1";
const CACHE_STATIQUE = `${VERSION}-static`;
const CACHE_PAGES = `${VERSION}-pages`;
const PAGE_HORS_LIGNE = "/hors-ligne";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_PAGES)
      .then((cache) => cache.addAll([PAGE_HORS_LIGNE, "/jouer"]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((noms) =>
        Promise.all(noms.filter((nom) => !nom.startsWith(VERSION)).map((nom) => caches.delete(nom))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const requete = event.request;
  const url = new URL(requete.url);

  // Uniquement notre origine, et uniquement GET.
  if (requete.method !== "GET" || url.origin !== self.location.origin) return;

  // Jamais de cache pour les API (résultats de tirage, statuts, etc.).
  if (url.pathname.startsWith("/api/")) return;

  // Ressources statiques immuables → cache d'abord.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/sons/") ||
    url.pathname.startsWith("/icones/")
  ) {
    event.respondWith(
      caches.match(requete).then(
        (reponse) =>
          reponse ||
          fetch(requete).then((res) => {
            const copie = res.clone();
            caches.open(CACHE_STATIQUE).then((cache) => cache.put(requete, copie));
            return res;
          }),
      ),
    );
    return;
  }

  // Navigations → réseau d'abord, secours hors-ligne.
  if (requete.mode === "navigate") {
    event.respondWith(
      fetch(requete)
        .then((res) => {
          const copie = res.clone();
          caches.open(CACHE_PAGES).then((cache) => cache.put(requete, copie));
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_PAGES);
          const page = await cache.match(requete);
          return page || cache.match(PAGE_HORS_LIGNE) || Response.error();
        }),
    );
  }
});
