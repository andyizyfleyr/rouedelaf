import { lireImage } from "@/server/images";

/**
 * GET /api/image/[nom] — sert une photo de cadeau stockée en base.
 *
 * Même origine que la roue : aucune règle CORS, aucun domaine à autoriser.
 * Cache long et immuable : le nom contient un UUID, une image ne change
 * jamais (la remplacer crée une nouvelle URL).
 */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ nom: string }> },
) {
  const { nom } = await params;
  const image = await lireImage(nom);
  if (!image) {
    return new Response("Image introuvable", { status: 404 });
  }

  return new Response(new Uint8Array(image.donnees), {
    headers: {
      "Content-Type": image.type,
      "Content-Length": String(image.donnees.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
