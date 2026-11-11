import "server-only";

import { randomUUID } from "node:crypto";

import { sql } from "@/lib/db";
import { detourer } from "@/server/detourage";

/**
 * Photos de cadeaux, stockées DANS LA BASE.
 *
 * Pourquoi pas sur le disque : sur Vercel le système de fichiers est en
 * lecture seule sauf /tmp, et /tmp n'est pas servi par le CDN. Un fichier
 * uploadé aurait disparu au redéploiement suivant — l'exploitant aurait vu
 * sa photo le jour même, puis une case vide la semaine d'après.
 *
 * La photo arrive déjà réduite (JPEG ≤ 3 Mo, en pratique ~150 ko après
 * redimensionnement côté navigateur) : la base n'est pas un CDN, mais pour
 * une poignée de visuels de 100 ko c'est le compromis le plus fiable.
 */

export const TYPES_IMAGE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Plafond après réduction dans le navigateur (voir src/lib/image-client.ts).
 *
 * Une photo de téléphone (4 à 10 Mo) est ramenée à ~120 Ko avant l'envoi :
 * cette limite n'est donc atteinte que si la réduction n'a pas pu se faire.
 */
export const TAILLE_IMAGE_MAX = 3 * 1024 * 1024; // 3 Mo

/** Extension sûre à partir du type MIME (jamais du nom de fichier fourni). */
export function extensionImage(type: string): string | null {
  return TYPES_IMAGE[type] ?? null;
}

/**
 * Enregistre les octets et renvoie l'URL servie par /api/image/[nom].
 *
 * Détourage automatique : une photo « packshot » (produit sur fond uni) est
 * convertie en PNG transparent rogné sur le produit. C'est ce qui permet aux
 * cases de la roue d'afficher l'objet lui-même, sans carte blanche autour.
 *
 * Si le détourage n'est pas pertinent (photo d'ambiance, fond non uni,
 * produit collé au bord), on enregistre l'image d'origine : mieux vaut une
 * photo avec son fond qu'un produit massacré. Le GIF, lui, n'est jamais
 * détouré (animation).
 */
export async function enregistrerImage(
  donnees: Buffer,
  type: string,
): Promise<{ url: string } | { erreur: string }> {
  const extension = extensionImage(type);
  if (!extension) {
    return { erreur: "Format non pris en charge : utilisez un JPG, PNG, WEBP ou GIF." };
  }
  if (donnees.length === 0) return { erreur: "Le fichier choisi est vide." };
  if (donnees.length > TAILLE_IMAGE_MAX) {
    return { erreur: "Image trop lourde : 3 Mo maximum." };
  }

  let octets = donnees;
  let format = extension;
  let mime = type;

  if (type !== "image/gif") {
    const detoure = await detourer(donnees);
    if (detoure) {
      octets = detoure.png;
      format = "png";
      mime = "image/png";
    }
  }

  const nom = `${randomUUID()}.${format}`;
  try {
    await sql`
      INSERT INTO images_cadeaux (nom, type, donnees, taille)
      VALUES (${nom}, ${mime}, ${octets}, ${octets.length})
    `;
    return { url: `/api/image/${nom}` };
  } catch (e) {
    console.error("[images] enregistrement", e);
    return { erreur: "Enregistrement de l'image impossible." };
  }
}

/** Dernières photos uploadées, pour la galerie du formulaire cadeau. */
export async function listerImages(limite = 24): Promise<string[]> {
  try {
    const lignes = await sql`
      SELECT nom FROM images_cadeaux ORDER BY cree_le DESC LIMIT ${limite}
    `;
    return lignes.map((l) => `/api/image/${String(l.nom)}`);
  } catch {
    return [];
  }
}

/** Octets d'une image, ou null si elle n'existe pas. */
export async function lireImage(
  nom: string,
): Promise<{ donnees: Buffer; type: string } | null> {
  // Le nom vient de l'URL : on n'accepte qu'un UUID + extension connue, pour
  // qu'aucune valeur exotique n'atteigne la base.
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/i.test(nom)) return null;
  try {
    const [ligne] = await sql`SELECT type, donnees FROM images_cadeaux WHERE nom = ${nom}`;
    if (!ligne) return null;
    return {
      type: String(ligne.type),
      donnees: ligne.donnees as Buffer,
    };
  } catch {
    return null;
  }
}
