import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  Gift,
  PackageCheck,
  TrendingUp,
  Users,
} from "lucide-react";

import { GraphiquesDashboard } from "@/components/admin/Graphiques";
import { Carte, Pastille, TitreOr } from "@/components/ui/Base";
import { formatDateHeure, formatNombre } from "@/lib/format";
import { listerGagnantsRecents, statistiques } from "@/server/data";
import { lireParametres } from "@/server/params";

export const metadata = { title: "Tableau de bord" };

/**
 * /admin — vue d'ensemble : tirages, cadeaux gagnés/récupérés, stock restant,
 * graphiques par jour, sources de trafic et performance par cadeau.
 */
export default function PageAdmin() {
  return (
    <div className="py-5">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-or/70 uppercase">Vue d&apos;ensemble</p>
          <TitreOr as="h1" className="mt-1 text-2xl sm:text-3xl">
            Tableau de bord
          </TitreOr>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/ecran" className="btn-fantome text-[12.5px]">
            Écran boutique <ArrowUpRight className="size-3.5" />
          </Link>
          <Link href="/admin/scan" className="btn-or !px-4 !py-2.5 text-[12.5px]">
            Scanner un code
          </Link>
        </div>
      </header>

      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/5" />}>
        <Contenu />
      </Suspense>
    </div>
  );
}

async function Contenu() {
  const [stats, parametres, gagnants] = await Promise.all([
    statistiques(),
    lireParametres(),
    listerGagnantsRecents(6),
  ]);

  const stockTotal = stats.parCadeau.reduce((s, c) => s + c.stock, 0);
  const stockEngage = stats.enAttenteTotal;

  return (
    <div className="flex flex-col gap-4">
      {/* Bandeau d'état */}
      <div className="flex flex-wrap items-center gap-2">
        <Pastille ton={parametres.activeJeu ? "vert" : "rouge"}>
          <span className={`size-1.5 rounded-full ${parametres.activeJeu ? "bg-emerald-400" : "bg-rose-400"}`} />
          {parametres.activeJeu ? "Jeu ouvert" : "Jeu fermé"}
        </Pastille>
        <Pastille ton="or">
          <CalendarClock className="size-3" /> Codes valables {parametres.dureeValiditeCodeJours} jours
        </Pastille>
        <Pastille ton="neutre">Roue rejouable à volonté</Pastille>
        <Link href="/admin/reglages" className="text-[11.5px] text-cendre/60 underline underline-offset-2 hover:text-or">
          Modifier
        </Link>
      </div>

      {/* Cartes chiffres clés */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CarteChiffre
          icone={<Users className="size-4" />}
          libelle="Tirages"
          valeur={formatNombre(stats.tiragesTotal)}
          detail={`+${stats.tiragesAujourdhui} aujourd'hui`}
        />
        <CarteChiffre
          icone={<Gift className="size-4" />}
          libelle="Cadeaux gagnés"
          valeur={formatNombre(stats.gagnesTotal)}
          detail={`${stats.tauxVictoire}% des tirages`}
        />
        <CarteChiffre
          icone={<PackageCheck className="size-4" />}
          libelle="Récupérés"
          valeur={formatNombre(stats.recuperesTotal)}
          detail={`${stats.enAttenteTotal} en attente`}
          accent
        />
        <CarteChiffre
          icone={<TrendingUp className="size-4" />}
          libelle="Stock restant"
          valeur={formatNombre(stockTotal)}
          detail={`${stockEngage} réservé${stockEngage > 1 ? "s" : ""}`}
        />
      </div>

      <GraphiquesDashboard stats={stats} />

      {/* Performance par cadeau + derniers gagnants */}
      <div className="grid gap-3 lg:grid-cols-5">
        <Carte className="lg:col-span-3 !p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="font-titre text-sm font-semibold tracking-wide text-or-clair uppercase">
              Performance par cadeau
            </h2>
            <Link href="/admin/cadeaux" className="text-[11.5px] text-cendre/60 hover:text-or">
              Gérer
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="tableau-admin w-full">
              <thead>
                <tr>
                  <th>Cadeau</th>
                  <th className="text-right">Stock</th>
                  <th className="text-right">Gagnés</th>
                  <th className="text-right">Retirés</th>
                  <th className="text-right">Taux</th>
                </tr>
              </thead>
              <tbody>
                {stats.parCadeau.map((c) => {
                  const taux = c.gagnes > 0 ? Math.round((c.recuperes / c.gagnes) * 100) : 0;
                  return (
                    <tr key={c.id}>
                      <td>
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: c.couleur }}
                          />
                          <span className="truncate">{c.nom}</span>
                        </span>
                      </td>
                      <td className="text-right tabular-nums">
                        <span className={c.stock === 0 ? "text-rose-300" : c.stock < 5 ? "text-amber-300" : ""}>
                          {c.stock}
                        </span>
                      </td>
                      <td className="text-right tabular-nums">{c.gagnes}</td>
                      <td className="text-right tabular-nums">{c.recuperes}</td>
                      <td className="text-right tabular-nums text-cendre/70">{taux}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Carte>

        <Carte className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-titre text-sm font-semibold tracking-wide text-or-clair uppercase">
              Derniers gagnants
            </h2>
            <Link href="/admin/ecran" className="text-[11.5px] text-cendre/60 hover:text-or">
              Live
            </Link>
          </div>
          <ul className="flex flex-col gap-2.5">
            {gagnants.length === 0 && (
              <li className="py-6 text-center text-[12.5px] text-cendre/60">
                Aucun gagnant pour l&apos;instant. Lancez la roue !
              </li>
            )}
            {gagnants.map((g) => (
              <li key={g.id} className="flex items-center gap-2.5">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-full text-[13px]"
                  style={{ backgroundColor: g.couleur ?? "#e8c66a" }}
                  aria-hidden
                >
                  🎁
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-creme">
                    {g.cadeau_nom ?? "Cadeau"}
                  </p>
                  <p className="truncate text-[11px] text-cendre/60">Gagné en boutique</p>
                </div>
                <time className="shrink-0 text-[10px] text-cendre/45">
                  {formatHeure(g.created_at)}
                </time>
              </li>
            ))}
          </ul>
        </Carte>
      </div>

      {stats.codesExpires > 0 && (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-[12px] text-amber-100">
          {stats.codesExpires} code{stats.codesExpires > 1 ? "s" : ""} expiré
          {stats.codesExpires > 1 ? "s" : ""} sans retrait. Pensez à relancer ces clients par
          WhatsApp.
        </p>
      )}
    </div>
  );
}

function CarteChiffre({
  icone,
  libelle,
  valeur,
  detail,
  accent,
}: {
  icone: React.ReactNode;
  libelle: string;
  valeur: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <Carte className={`!p-4 ${accent ? "bg-gradient-to-br from-emeraude/20 to-transparent" : ""}`}>
      <div className="flex items-center gap-2 text-or/80">
        {icone}
        <span className="text-[10.5px] tracking-[0.14em] uppercase">{libelle}</span>
      </div>
      <p className="mt-1.5 font-titre text-2xl font-bold text-creme sm:text-[1.7rem]">{valeur}</p>
      <p className="text-[11px] text-cendre/60">{detail}</p>
    </Carte>
  );
}

function formatHeure(date: string | Date): string {
  return formatDateHeure(date).split(" à ")[1] ?? "";
}
