"use client";

/**
 * Réduction d'une photo AVANT l'envoi, dans le navigateur.
 *
 * Pourquoi : une photo de téléphone fait 4 à 10 Mo (12 Mpx). L'envoyer telle
 * quelle échoue (limite de la Server Action) et n'a aucun intérêt : la roue
 * affiche la case sur 60 pixels de large. On redimensionne donc à 1000 px de
 * côté maximum et on réencode en JPEG : résultat ~120 Ko, sans différence
 * visible sur la roue ni dans l'admin.
 *
 * Le PNG est conservé quand il a de la transparence (logos détourés), sinon
 * tout part en JPEG. En cas d'échec (format exotique, canvas indisponible),
 * on renvoie le fichier d'origine : c'est au serveur de trancher.
 */

const DIMENSION_MAX = 1000;
const QUALITE = 0.85;
/** Au-delà, on tente quand même la réduction (mais on prévient). */
export const TAILLE_SOURCE_MAX = 40 * 1024 * 1024;

export type ResultatCompression = {
  fichier: File;
  /** Taille d'origine, pour afficher « 6,2 Mo → 140 ko ». */
  tailleAvant: number;
  reduite: boolean;
};

function chargerImage(fichier: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fichier);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible"));
    };
    image.src = url;
  });
}

/** Le PNG a-t-il réellement des pixels transparents ? */
function aDeLaTransparence(image: HTMLImageElement): boolean {
  try {
    const taille = 48;
    const canvas = document.createElement("canvas");
    canvas.width = taille;
    canvas.height = taille;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(image, 0, 0, taille, taille);
    const donnees = ctx.getImageData(0, 0, taille, taille).data;
    for (let i = 3; i < donnees.length; i += 4) {
      if (donnees[i] < 250) return true;
    }
  } catch {
    // Canvas « tainted » ou absent : on suppose opaque.
  }
  return false;
}

export async function compresserImage(fichier: File): Promise<ResultatCompression> {
  const tailleAvant = fichier.size;

  // Un GIF animé ou un SVG n'a rien à faire dans une case de roue ; on laisse
  // le serveur refuser plutôt que de le transformer en image fixe muette.
  if (fichier.type === "image/gif") {
    return { fichier, tailleAvant, reduite: false };
  }

  try {
    const image = await chargerImage(fichier);
    const echelle = Math.min(1, DIMENSION_MAX / Math.max(image.width, image.height));
    const largeur = Math.max(1, Math.round(image.width * echelle));
    const hauteur = Math.max(1, Math.round(image.height * echelle));

    const canvas = document.createElement("canvas");
    canvas.width = largeur;
    canvas.height = hauteur;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { fichier, tailleAvant, reduite: false };

    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, largeur, hauteur);

    const garderPng = fichier.type === "image/png" && aDeLaTransparence(image);
    const type = garderPng ? "image/png" : "image/jpeg";
    const extension = garderPng ? "png" : "jpg";

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, QUALITE),
    );
    if (!blob) return { fichier, tailleAvant, reduite: false };

    // Si la « réduction » produit plus lourd (petite image déjà optimisée),
    // on garde l'original.
    if (blob.size >= tailleAvant) return { fichier, tailleAvant, reduite: false };

    const nom = fichier.name.replace(/\.[^.]+$/, "") || "photo";
    return {
      fichier: new File([blob], `${nom}.${extension}`, { type }),
      tailleAvant,
      reduite: true,
    };
  } catch {
    return { fichier, tailleAvant, reduite: false };
  }
}
