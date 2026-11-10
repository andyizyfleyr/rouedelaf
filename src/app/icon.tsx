import { ImageResponse } from "next/og";

/** Favicon généré à la volée (roue dorée sur fond nuit). */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Satori (moteur d'ImageResponse) ne gère que les dégradés linéaires/radiaux :
// la roue est donc dessinée en SVG inline, ce qui reste net à toutes les tailles.
const ROUE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="j" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff3c4"/><stop offset="0.5" stop-color="#c9a227"/><stop offset="1" stop-color="#7a5a14"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="49" fill="url(#j)"/>
  <g>
    <path d="M50 50 L50 6 A44 44 0 0 1 81 19 Z" fill="#e8c66a"/>
    <path d="M50 50 L81 19 A44 44 0 0 1 94 50 Z" fill="#7c1d2e"/>
    <path d="M50 50 L94 50 A44 44 0 0 1 81 81 Z" fill="#e8c66a"/>
    <path d="M50 50 L81 81 A44 44 0 0 1 50 94 Z" fill="#1f6f5c"/>
    <path d="M50 50 L50 94 A44 44 0 0 1 19 81 Z" fill="#e8c66a"/>
    <path d="M50 50 L19 81 A44 44 0 0 1 6 50 Z" fill="#7c1d2e"/>
    <path d="M50 50 L6 50 A44 44 0 0 1 19 19 Z" fill="#e8c66a"/>
    <path d="M50 50 L19 19 A44 44 0 0 1 50 6 Z" fill="#1f6f5c"/>
  </g>
  <circle cx="50" cy="50" r="13" fill="#f8e7a8"/>
  <circle cx="50" cy="50" r="7" fill="#0a0908"/>
</svg>`;

export default function Icone() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0908",
        }}
      >
        <img width={56} height={56} alt="" src={`data:image/svg+xml;utf8,${encodeURIComponent(ROUE_SVG)}`} />
      </div>
    ),
    size,
  );
}
