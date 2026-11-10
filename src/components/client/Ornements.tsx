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
          <stop offset="0%" stopColor="#0b5d3b" />
          <stop offset="100%" stopColor="#04140d" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.4l3.1 4.3H8.9L12 2.4zM7.4 8.2h9.2l-2 2.7h4.1L12 19.4 5.3 10.9h4.1l-2-2.7z"
        fill="url(#sapin-vert)"
        stroke="#d4af37"
        strokeOpacity="0.45"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <rect x="10.9" y="19.2" width="2.2" height="2.4" rx="0.5" fill="#8a6508" />
      <circle cx="12" cy="2.2" r="1.5" fill="#f5d77a" />
    </svg>
  );
}

/** Flocon à six branches. */
export function Flocon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <g stroke="#d8c9a3" strokeWidth="1.5" strokeLinecap="round" opacity="0.85">
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
        fill="#0b5d3b"
        stroke="#128a56"
        strokeWidth="0.6"
      />
      <path
        d="M12 12c3.6-3.4 8.4-2.6 9.6 1.2-2.6 2.2-6.6 1.9-9.6-1.2z"
        fill="#0b5d3b"
        stroke="#128a56"
        strokeWidth="0.6"
      />
      <circle cx="8.6" cy="14.6" r="1.9" fill="#b3122b" />
      <circle cx="15.4" cy="14.6" r="1.9" fill="#d93a4a" />
      <circle cx="12" cy="12.6" r="2.1" fill="#7a0b14" />
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
            background: i % 3 === 0 ? "#f5d77a" : i % 3 === 1 ? "#d93a4a" : "#d8c9a3",
            boxShadow: `0 0 8px 1px ${
              i % 3 === 0 ? "rgba(245,215,122,0.75)" : i % 3 === 1 ? "rgba(217,58,74,0.7)" : "rgba(216,201,163,0.55)"
            }`,
            animationDelay: `${(i % 4) * 0.35}s`,
          }}
        />
      ))}
    </div>
  );
}
