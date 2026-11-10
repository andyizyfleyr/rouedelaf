"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Copy,
  Download,
  FileSpreadsheet,
  MessageCircle,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { BoutonFantome, BoutonOr, Carte, Pastille } from "@/components/ui/Base";
import { formatDateHeure } from "@/lib/format";
import type { LigneJoueur } from "@/lib/types";

/**
 * Tableau des joueurs : recherche, filtre par source, pagination, exports.
 * Les exports sont des liens vers /admin/joueurs/export (protégé par session).
 */
export function TableJoueurs({
  joueurs,
  total,
  page,
  recherche,
  source,
}: {
  joueurs: LigneJoueur[];
  total: number;
  page: number;
  recherche: string;
  source: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(recherche);
  const [src, setSrc] = useState(source);
  const [copie, setCopie] = useState(false);
  const [enTransition, demarrer] = useTransition();
  const parPage = 50;
  const pages = Math.max(Math.ceil(total / parPage), 1);

  function filtrer(nouveauQ = q, nouveauSrc = src) {
    const params = new URLSearchParams();
    if (nouveauQ.trim()) params.set("q", nouveauQ.trim());
    if (nouveauSrc && nouveauSrc !== "tous") params.set("src", nouveauSrc);
    demarrer(() => router.push(`/admin/joueurs?${params.toString()}`));
  }

  async function copierNumeros() {
    const numeros = joueurs.map((j) => `+${j.telephone}`).join("\n");
    try {
      await navigator.clipboard.writeText(numeros);
      setCopie(true);
      setTimeout(() => setCopie(false), 2200);
    } catch {
      /* presse-papiers refusé */
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Barre d'outils */}
      <Carte className="!p-3.5">
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cendre/50" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && filtrer()}
                placeholder="Rechercher un nom ou un numéro…"
                className="champ !py-2.5 !pl-9 text-[13px]"
                aria-label="Rechercher"
              />
            </div>
            <div className="relative">
              <SlidersHorizontal className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-cendre/50" />
              <select
                value={src}
                onChange={(e) => {
                  setSrc(e.target.value);
                  filtrer(q, e.target.value);
                }}
                className="champ !w-auto !py-2.5 !pl-8 text-[12.5px]"
                aria-label="Filtrer par source"
              >
                <option value="tous">Toutes sources</option>
                <option value="facebook">Facebook</option>
                <option value="tiktok">TikTok</option>
                <option value="boutique">Boutique</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="direct">Direct</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Pastille ton="or">
              <Users className="size-3" /> {total} joueur{total > 1 ? "s" : ""}
            </Pastille>

            <a href="/admin/joueurs/export?format=csv" className="btn-fantome !px-3 !py-1.5 text-[11.5px]">
              <FileSpreadsheet className="size-3.5" /> Export CSV
            </a>
            <a
              href="/admin/joueurs/export?format=whatsapp"
              className="btn-fantome !px-3 !py-1.5 text-[11.5px]"
            >
              <Download className="size-3.5" /> Numéros WhatsApp
            </a>
            <button
              type="button"
              onClick={copierNumeros}
              className="btn-fantome !px-3 !py-1.5 text-[11.5px]"
            >
              {copie ? (
                <>
                  <Copy className="size-3.5 text-emerald-400" /> Copié !
                </>
              ) : (
                <>
                  <Copy className="size-3.5" /> Copier cette page
                </>
              )}
            </button>
            <a
              href="/admin/joueurs/export?format=memo"
              className="text-[11px] text-cendre/55 underline-offset-2 hover:text-or hover:underline"
              title="Blocs de 20 numéros, pratiques pour une diffusion en groupe"
            >
              blocs de 20
            </a>
          </div>
        </div>
      </Carte>

      {/* Tableau */}
      <Carte className={`!p-0 overflow-hidden ${enTransition ? "opacity-60" : ""}`}>
        <div className="overflow-x-auto">
          <table className="tableau-admin w-full min-w-[720px]">
            <thead>
              <tr>
                <th>Joueur</th>
                <th>WhatsApp</th>
                <th>Inscription</th>
                <th>Source</th>
                <th>Cadeau</th>
                <th>Code</th>
                <th className="text-center">Remis</th>
              </tr>
            </thead>
            <tbody>
              {joueurs.map((j) => (
                <tr key={j.id}>
                  <td>
                    <span className="font-medium text-creme">{j.nom}</span>
                    {j.bloque && <span className="ml-1.5 text-[10px] text-rose-300">bloqué</span>}
                  </td>
                  <td className="font-mono text-[12px] whitespace-nowrap">
                    <a
                      href={`https://wa.me/${j.telephone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-300/90 hover:text-emerald-200"
                    >
                      <MessageCircle className="size-3" />
                      {j.telephone_aff ?? j.telephone}
                    </a>
                  </td>
                  <td className="whitespace-nowrap text-[12px] text-cendre/75">
                    {formatDateHeure(j.created_at)}
                  </td>
                  <td>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10.5px] capitalize text-cendre">
                      {j.source}
                    </span>
                  </td>
                  <td className="max-w-[180px] truncate text-[12.5px]">
                    {j.cadeau_nom ?? (
                      <span className="text-cendre/40">— {j.statut ?? "pas encore joué"}</span>
                    )}
                  </td>
                  <td className="font-mono text-[11.5px] text-or/85">{j.code_unique ?? "—"}</td>
                  <td className="text-center">
                    {j.recupere === null ? (
                      <span className="text-cendre/35">—</span>
                    ) : j.recupere ? (
                      <span className="text-emerald-300">✓</span>
                    ) : (
                      <span className="text-amber-200/80">à venir</span>
                    )}
                  </td>
                </tr>
              ))}
              {joueurs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[13px] text-cendre/60">
                    Aucun joueur ne correspond à cette recherche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Carte>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <Pastille ton="neutre">
            Page {page} / {pages}
          </Pastille>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/joueurs?${new URLSearchParams({
                  ...(recherche ? { q: recherche } : {}),
                  ...(source !== "tous" ? { src: source } : {}),
                  page: String(page - 1),
                }).toString()}`}
                className="btn-fantome !px-3 !py-1.5 text-[12px]"
              >
                ← Précédent
              </Link>
            )}
            {page < pages && (
              <BoutonOr
                className="!w-auto !px-3 !py-1.5 text-[12px]"
                onClick={() =>
                  router.push(
                    `/admin/joueurs?${new URLSearchParams({
                      ...(recherche ? { q: recherche } : {}),
                      ...(source !== "tous" ? { src: source } : {}),
                      page: String(page + 1),
                    }).toString()}`,
                  )
                }
              >
                Suivant →
              </BoutonOr>
            )}
          </div>
        </div>
      )}

      <BoutonFantome className="mx-auto text-[11.5px]" onClick={() => filtrer()}>
        Actualiser
      </BoutonFantome>
    </div>
  );
}
