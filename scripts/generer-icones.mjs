/**
 * Génère les icônes PWA (192, 512, maskable 512) sans dépendance externe.
 * Exécution : node scripts/generer-icones.mjs
 * (déjà fait une fois : les PNG sont versionnés dans public/icones)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const octet of buf) c = CRC_TABLE[(c ^ octet) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(data.length);
  const corps = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corps));
  return Buffer.concat([longueur, corps, crc]);
};

function dessinerRoue(taille, marge) {
  const px = (x, y) => (y * taille + x) * 4;
  const pixels = Buffer.alloc(taille * taille * 4);
  const cx = taille / 2;
  const cy = taille / 2;
  const rayonExterieur = taille / 2 - marge;
  const rayonInterieur = rayonExterieur * 0.16;

  const secteurs = ["#e8c66a", "#7c1d2e", "#e8c66a", "#1f6f5c", "#e8c66a", "#7c1d2e", "#e8c66a", "#1f6f5c"];
  const hexToRgb = (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];

  for (let y = 0; y < taille; y += 1) {
    for (let x = 0; x < taille; x += 1) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const d = Math.hypot(dx, dy);
      let couleur = [10, 9, 8, 255]; // fond nuit

      if (d <= rayonExterieur) {
        // Bordure dorée
        couleur = [248, 231, 168, 255];
        if (d <= rayonExterieur - Math.max(2, taille * 0.03)) {
          const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 450) % 360;
          const secteur = secteurs[Math.floor(angle / 45) % secteurs.length];
          couleur = [...hexToRgb(secteur), 255];
        }
        if (d <= rayonInterieur) {
          couleur = [10, 9, 8, 255];
        }
        if (d <= rayonInterieur * 0.55) {
          couleur = [248, 231, 168, 255];
        }
      }

      const i = px(x, y);
      pixels[i] = couleur[0];
      pixels[i + 1] = couleur[1];
      pixels[i + 2] = couleur[2];
      pixels[i + 3] = couleur[3];
    }
  }

  // Lignes brutes PNG (filtre 0 par ligne)
  const brut = Buffer.alloc(taille * (taille * 4 + 1));
  for (let y = 0; y < taille; y += 1) {
    brut[y * (taille * 4 + 1)] = 0;
    pixels.copy(brut, y * (taille * 4 + 1) + 1, y * taille * 4, (y + 1) * taille * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(taille, 0);
  ihdr.writeUInt32BE(taille, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(brut, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icones", { recursive: true });
for (const [nom, taille, marge] of [
  ["icone-192.png", 192, 8],
  ["icone-512.png", 512, 20],
  ["icone-maskable-512.png", 512, 0],
]) {
  writeFileSync(`public/icones/${nom}`, dessinerRoue(taille, marge));
  console.log("✅", nom);
}
