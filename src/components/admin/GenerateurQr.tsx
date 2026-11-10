"use client";

import { useState } from "react";
import { Copy, Download, ExternalLink, Printer } from "lucide-react";

import { Carte, Pastille } from "@/components/ui/Base";

type Qr = { cle: string; titre: string; url: string; image: string };

/**
 * Affichage des QR codes avec téléchargement PNG et impression.
 * La fonction d'impression n'imprime que la carte sélectionnée (CSS @media print
 * défini ci-dessous) : pratique pour une affiche de comptoir.
 */
export function GenerateurQr({ qrCodes, baseUrl }: { qrCodes: Qr[]; baseUrl: string }) {
  const [copie, setCopie] = useState<string | null>(null);

  async function copier(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(url);
      setTimeout(() => setCopie(null), 2000);
    } catch {
      /* presse-papiers indisponible */
    }
  }

  return (
    <>
      <div className="mb-4 rounded-xl border border-or/20 bg-or/5 px-3.5 py-2.5 text-[12px] text-or-clair">
        Domaine utilisé : <code className="font-mono">{baseUrl}</code>
        {baseUrl.includes("localhost") && (
          <span className="ml-2 text-amber-200">
            ⚠️ En production, renseignez NEXT_PUBLIC_APP_URL avec votre vrai domaine.
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {qrCodes.map((qr) => (
          <Carte key={qr.cle} className="qr-carte flex flex-col items-center !p-4 text-center">
            <h2 className="font-titre text-[13.5px] font-semibold tracking-wide text-or-clair uppercase">
              {qr.titre}
            </h2>
            <div className="my-3 rounded-xl border border-white/10 bg-white p-2">
              {/* Data-URL générée côté serveur : <img> volontaire */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.image} alt={`QR code ${qr.titre}`} className="size-40" />
            </div>
            <p className="mb-3 w-full truncate font-mono text-[10px] text-cendre/50">{qr.url}</p>

            <div className="mt-auto flex w-full flex-wrap justify-center gap-1.5">
              <a
                href={qr.image}
                download={`roue-qr-${qr.cle}.png`}
                className="btn-fantome !px-2.5 !py-1.5 text-[11px]"
              >
                <Download className="size-3.5" /> PNG
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-fantome !px-2.5 !py-1.5 text-[11px]"
              >
                <Printer className="size-3.5" /> Imprimer
              </button>
              <button
                type="button"
                onClick={() => copier(qr.url)}
                className="btn-fantome !px-2.5 !py-1.5 text-[11px]"
              >
                <Copy className="size-3.5" /> {copie === qr.url ? "Copié" : "Lien"}
              </button>
              <a
                href={qr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-fantome !px-2.5 !py-1.5 text-[11px]"
              >
                <ExternalLink className="size-3.5" /> Tester
              </a>
            </div>
          </Carte>
        ))}
      </div>

      <Carte className="mt-4 !p-4">
        <h2 className="font-titre text-[13px] font-semibold tracking-wide text-or-clair uppercase">
          Conseils d&apos;impression
        </h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-[12px] leading-relaxed text-cendre/75">
          <li>• Taille minimale du QR : 8 cm × 8 cm, posé à hauteur d&apos;yeux (1,3 m – 1,6 m).</li>
          <li>• Marquez bien la <strong className="text-creme">source</strong> : chaque affiche a son QR.</li>
          <li>• Fond blanc obligatoire autour du QR (zone de silence de 2 modules).</li>
          <li>• Ajoutez le texte « Scannez pour tenter de gagner un cadeau » à côté.</li>
          <li>• Contrôlez le rendu avec votre téléphone avant impression en série.</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pastille ton="or">1 impression = 1 source tracée</Pastille>
          <Pastille ton="neutre">Idéalement format A5</Pastille>
        </div>
      </Carte>

      {/* Impression : on n'imprime que les cartes QR, pas l'interface admin */}
      <style>{`
        @media print {
          body { background: #fff !important; color: #000 !important; }
          header, aside, nav, footer, form { display: none !important; }
          .qr-carte { break-inside: avoid; border: 1px solid #ccc !important; background: #fff !important; color: #000 !important; box-shadow: none !important; }
          .qr-carte h2, .qr-carte p { color: #000 !important; }
          .qr-carte > div:last-child { display: none !important; }
          main { padding-left: 0 !important; }
        }
      `}</style>
    </>
  );
}
