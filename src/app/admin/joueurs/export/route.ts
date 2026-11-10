import { exigerAdmin } from "@/lib/session";
import { formaterTelephone } from "@/lib/format";
import { listerJoueurs, numerosPourExport } from "@/server/data";

/**
 * GET /admin/joueurs/export?format=csv|whatsapp|memo
 *
 * - csv      : nom, téléphone, date, source, cadeau, code, récupéré
 *              (séparateur « ; » et BOM UTF-8 → s'ouvre directement dans Excel)
 * - whatsapp : un numéro par ligne au format international, prêt à coller
 *              dans une diffusion WhatsApp Business
 * - memo     : blocks de 20 numéros séparés par une ligne vide (pratique pour
 *              copier dans un groupe de discussion limité)
 *
 * La route est protégée par la session admin (aucun accès public au fichier).
 */
export async function GET(request: Request) {
  try {
    await exigerAdmin();
  } catch {
    return new Response("Accès refusé", { status: 401 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";

  if (format === "whatsapp" || format === "memo") {
    const numeros = await numerosPourExport();
    let contenu: string;

    if (format === "memo") {
      const blocs: string[] = [];
      for (let i = 0; i < numeros.length; i += 20) {
        blocs.push(
          numeros
            .slice(i, i + 20)
            .map((n) => `+${n.telephone}`)
            .join("\n"),
        );
      }
      contenu = blocs.join("\n\n");
    } else {
      contenu = numeros.map((n) => `+${n.telephone}`).join("\n");
    }

    return new Response(contenu, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="numeros-whatsapp-${dateJour()}.txt"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // CSV complet (tous les joueurs, sans pagination).
  const { joueurs } = await listerJoueurs({ limite: 5000, page: 1 });

  const entetes = [
    "Nom",
    "Telephone",
    "Telephone affichage",
    "Date inscription",
    "Source",
    "Cadeau",
    "Statut",
    "Code",
    "Recupere",
    "Consentement",
  ];

  const lignes = joueurs.map((j) =>
    [
      j.nom,
      j.telephone,
      j.telephone_aff ?? formaterTelephone(j.telephone),
      new Date(j.created_at).toISOString(),
      j.source,
      j.cadeau_nom ?? "",
      j.statut ?? "pas encore joue",
      j.code_unique ?? "",
      j.recupere === null ? "" : j.recupere ? "oui" : "non",
      j.consentement ? "oui" : "non",
    ]
      .map(echapperCsv)
      .join(";"),
  );

  // BOM UTF-8 : Excel reconnaît les accents correctement.
  const csv = `\uFEFF${[entetes.join(";"), ...lignes].join("\r\n")}\r\n`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="joueurs-roue-${dateJour()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function echapperCsv(valeur: string): string {
  const propre = String(valeur ?? "");
  // Neutralise les formules Excel (=, +, -, @) : protection contre l'injection CSV.
  const securise = /^[=+\-@]/.test(propre) ? `'${propre}` : propre;
  return `"${securise.replace(/"/g, '""')}"`;
}

function dateJour(): string {
  return new Date().toISOString().slice(0, 10);
}
