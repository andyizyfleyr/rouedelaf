"use client";

/**
 * Ornements de Noël — décor pur, sans état, sans dépendance.
 *
 * Tout est en SVG inline : aucune image à charger (les clients jouent en 3G
 * dans la boutique), aucune police d'icône, et le rendu reste net à toutes
 * les tailles. Chaque ornement est `aria-hidden` et `pointer-events: none` :
 * il ne peut donc ni être lu par un lecteur d'écran ni voler un appui.
 */

/** Sapin stylisé : trois étages, tronc, étoile dorée. */
export function Sapin({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="sapin-vert" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f7a53" />
          <stop offset="100%" stopColor="#0f2c20" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.4l3.1 4.3H8.9L12 2.4zM7.4 8.2h9.2l-2 2.7h4.1L12 19.4 5.3 10.9h4.1l-2-2.7z"
        fill="url(#sapin-vert)"
        stroke="#e8c66a"
        strokeOpacity="0.45"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <rect x="10.9" y="19.2" width="2.2" height="2.4" rx="0.5" fill="#7a5a14" />
      <circle cx="12" cy="2.2" r="1.5" fill="#ffd977" />
    </svg>
  );
}

/** Flocon à six branches. */
export function Flocon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <g stroke="#a9d8c9" strokeWidth="1.5" strokeLinecap="round" opacity="0.85">
        <path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2L3.8 16.8" />
        <path d="M12 6.2l-2 1.6M12 6.2l2 1.6M12 17.8l-2-1.6M12 17.8l2-1.6" strokeWidth="1.1" />
      </g>
    </svg>
  );
}

/** Baie de houx : deux feuilles + trois fruits rouges. */
export function Houx({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path
        d="M12 12c-3.6-3.4-8.4-2.6-9.6 1.2 2.6 2.2 6.6 1.9 9.6-1.2z"
        fill="#16402e"
        stroke="#2f7a53"
        strokeWidth="0.6"
      />
      <path
        d="M12 12c3.6-3.4 8.4-2.6 9.6 1.2-2.6 2.2-6.6 1.9-9.6-1.2z"
        fill="#16402e"
        stroke="#2f7a53"
        strokeWidth="0.6"
      />
      <circle cx="8.6" cy="14.6" r="1.9" fill="#b3121f" />
      <circle cx="15.4" cy="14.6" r="1.9" fill="#d9263a" />
      <circle cx="12" cy="12.6" r="2.1" fill="#8e0c17" />
    </svg>
  );
}

/**
 * Bandeau de guirlande : une ligne de petites ampoules dorées et rouges.
 * Posé en haut des pages « feuille » (inscription, résultat), il donne le
 * ton de fête sans manger de hauteur utile.
 */
export function Guirlande({ className = "" }: { className?: string }) {
  const ampoules = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div
      aria-hidden
      className={`pointer-events-none flex items-center justify-between gap-1 overflow-hidden ${className}`}
    >
      {ampoules.map((i) => (
        <span
          key={i}
          className="animate-scintille block size-1.5 shrink-0 rounded-full"
          style={{
            background: i % 3 === 0 ? "#ffd977" : i % 3 === 1 ? "#d9263a" : "#a9d8c9",
            boxShadow: `0 0 8px 1px ${
              i % 3 === 0 ? "rgba(255,217,119,0.75)" : i % 3 === 1 ? "rgba(217,38,58,0.7)" : "rgba(169,216,201,0.6)"
            }`,
            animationDelay: `${(i % 4) * 0.35}s`,
          }}
        />
      ))}
    </div>
  );
}
