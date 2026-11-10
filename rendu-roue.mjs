/**
 * OUTIL DE DÉVELOPPEMENT — rend la roue en PNG pour vérifier visuellement
 * la géométrie et la lisibilité des libellés (aucun navigateur requis).
 *
 *   node --experimental-strip-types rendu-roue.mjs
 */
import sharp from "sharp";
import { construireCases, cheminSecteur, couleurTexteSur, angleParCase } from "./src/lib/roue.ts";

const cadeaux = [
  { id: 1, nom: "Bon d'achat 5 000", couleur: "#C9A227", icone: "🎟️", probabilite: 2, stock: 10 },
  { id: 2, nom: "Casquette boutique", couleur: "#8B1E3F", icone: "🧢", probabilite: 12, stock: 25 },
  { id: 3, nom: "Sac de courses", couleur: "#1F6F5C", icone: "🛍️", probabilite: 15, stock: 30 },
  { id: 4, nom: "Crème hydratante", couleur: "#B4552A", icone: "🧴", probabilite: 10, stock: 20 },
  { id: 5, nom: "Stylo publicitaire", couleur: "#3A4A7A", icone: "🖊️", probabilite: 26, stock: 80 },
  { id: 6, nom: "Échantillon parfum", couleur: "#6B4A7A", icone: "🌸", probabilite: 20, stock: 60 },
];

const cases = construireCases(cadeaux);
const T = 760, C = T / 2, R = T / 2 - 12;
const secteur = angleParCase(cases.length);

const decouper = (texte, max) => {
  if (texte.length <= max) return [texte];
  const mots = texte.split(" "); const l = []; let c = "";
  for (const m of mots) { const e = c ? `${c} ${m}` : m; if (e.length > max && c) { l.push(c); c = m; } else c = e; }
  if (c) l.push(c); return l.slice(0, 2);
};

const labels = cases.map((c, i) => {
  const angle = i * secteur + secteur / 2;
  const libelle = c.id < 0 ? "PERDU" : c.nom;
  const lignes = decouper(libelle, libelle.length > 12 ? 12 : 16);
  const retourner = angle > 180;
  const dTexte = R - 40, dIcone = R * 0.42;
  const tspan = lignes.map((l, k) => `<tspan x="0" dy="${k === 0 ? (retourner ? -6 : 0) : 13}">${l}</tspan>`).join("");
  return `<g transform="rotate(${angle} ${C} ${C})">
    <text x="${C}" y="${C - dIcone}" text-anchor="middle" font-size="34" font-family="DejaVu Sans">${c.icone}</text>
    <g transform="translate(${C} ${C - dTexte}) rotate(${retourner ? 90 : -90})">
      <text x="0" y="0" text-anchor="${retourner ? "start" : "end"}" dominant-baseline="middle" fill="${couleurTexteSur(c.couleur)}"
            font-size="${lignes.length > 1 ? 19 : 22}" font-weight="700" font-family="DejaVu Sans">${tspan}</text>
    </g>
  </g>`;
}).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}" viewBox="0 0 ${T} ${T}">
  <defs>
    <linearGradient id="j" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff3c4"/><stop offset="22%" stop-color="#c9a227"/>
      <stop offset="50%" stop-color="#7a5a14"/><stop offset="72%" stop-color="#e8c66a"/><stop offset="100%" stop-color="#5d4410"/>
    </linearGradient>
    <radialGradient id="c" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#fff3c4"/><stop offset="45%" stop-color="#e8c66a"/><stop offset="100%" stop-color="#8d6b1d"/>
    </radialGradient>
  </defs>
  <rect width="${T}" height="${T}" fill="#0a0908"/>
  <circle cx="${C}" cy="${C}" r="${R}" fill="url(#j)"/>
  <circle cx="${C}" cy="${C}" r="${R - 11}" fill="#0b0a09"/>
  ${cases.map((c, i) => `<path d="${cheminSecteur(C, C, R - 13, i * secteur, (i + 1) * secteur)}" fill="${c.couleur}" stroke="rgba(0,0,0,0.3)" stroke-width="1.6"/>`).join("")}
  ${cases.map((_, i) => { const a = ((i * secteur - 90) * Math.PI) / 180; const r = R - 17;
    return `<circle cx="${C + r * Math.cos(a)}" cy="${C + r * Math.sin(a)}" r="5" fill="#fff3c4" opacity="0.85"/>`; }).join("")}
  ${labels}
  <path d="M ${C} 14 L ${C + 28} 88 L ${C} 122 L ${C - 28} 88 Z" fill="#e8c66a" stroke="#5d4410" stroke-width="2.5"/>
  <circle cx="${C}" cy="${C}" r="54" fill="url(#j)"/>
  <circle cx="${C}" cy="${C}" r="41" fill="url(#c)"/>
  <circle cx="${C}" cy="${C}" r="19" fill="#0b0a09"/>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("public/apercu-roue.png");
console.log("✅ public/apercu-roue.png —", cases.length, "cases");
