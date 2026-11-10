"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Carte } from "@/components/ui/Base";
import type { StatsDashboard } from "@/lib/types";

/**
 * Graphiques du tableau de bord (Recharts).
 *
 * Performance : les graphiques sont montés APRÈS le premier rendu et
 * `ResponsiveContainer` évite tout calcul de largeur inutile. Sur mobile,
 * on n'affiche que l'essentiel.
 */
const COULEURS = ["#e8c66a", "#7c1d2e", "#1f6f5c", "#a9822b", "#b4552a", "#3a4a7a", "#6b4a7a"];

export function GraphiquesDashboard({ stats }: { stats: StatsDashboard }) {
  const parJour = useMemo(
    () =>
      stats.parJour.map((j) => ({
        ...j,
        libelle: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(
          new Date(`${j.jour}T12:00:00`),
        ),
      })),
    [stats.parJour],
  );

  const sources = useMemo(() => {
    const total = stats.parSource.reduce((s, x) => s + x.joueurs, 0) || 1;
    return stats.parSource.map((s) => ({
      ...s,
      pourcentage: Math.round((s.joueurs / total) * 100),
    }));
  }, [stats.parSource]);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {/* Activité sur 14 jours */}
      <Carte className="lg:col-span-2 !p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-titre text-sm font-semibold tracking-wide text-or-clair uppercase">
            14 derniers jours
          </h2>
          <div className="flex gap-3 text-[10px] text-cendre/70">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-or" /> Joueurs
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-emeraude" /> Gains
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-bordeaux-clair" /> Retraits
            </span>
          </div>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={parJour} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="gradJoueurs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e8c66a" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#e8c66a" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradGains" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1f6f5c" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#1f6f5c" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(232,198,106,0.1)" vertical={false} />
              <XAxis
                dataKey="libelle"
                tick={{ fill: "#b9b0a2", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#b9b0a2", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={38}
              />
              <Tooltip
                contentStyle={{
                  background: "#121010",
                  border: "1px solid rgba(232,198,106,0.35)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#f6efe1",
                }}
                labelStyle={{ color: "#e8c66a", fontWeight: 600 }}
              />
              <Area
                type="monotone"
                dataKey="joueurs"
                name="Joueurs"
                stroke="#e8c66a"
                strokeWidth={2}
                fill="url(#gradJoueurs)"
              />
              <Area
                type="monotone"
                dataKey="gagnes"
                name="Gains"
                stroke="#2f8d76"
                strokeWidth={2}
                fill="url(#gradGains)"
              />
              <Area
                type="monotone"
                dataKey="recuperes"
                name="Retraits"
                stroke="#a52a3f"
                strokeWidth={1.5}
                fill="transparent"
                strokeDasharray="4 3"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Carte>

      {/* Sources de trafic */}
      <Carte className="!p-4">
        <h2 className="mb-2 font-titre text-sm font-semibold tracking-wide text-or-clair uppercase">
          Origine des joueurs
        </h2>
        {sources.length === 0 ? (
          <p className="py-12 text-center text-[12px] text-cendre/60">Pas encore de données.</p>
        ) : (
          <>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sources}
                    dataKey="joueurs"
                    nameKey="source"
                    innerRadius="55%"
                    outerRadius="88%"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {sources.map((s, i) => (
                      <Cell key={s.source} fill={COULEURS[i % COULEURS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#121010",
                      border: "1px solid rgba(232,198,106,0.35)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 flex flex-col gap-1.5">
              {sources.map((s, i) => (
                <li key={s.source} className="flex items-center justify-between text-[11.5px]">
                  <span className="flex items-center gap-1.5 capitalize text-cendre">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: COULEURS[i % COULEURS.length] }}
                    />
                    {s.source}
                  </span>
                  <span className="tabular-nums text-cendre/70">
                    {s.joueurs} · {s.pourcentage}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Carte>

      {/* Stock par cadeau */}
      <Carte className="lg:col-span-3 !p-4">
        <h2 className="mb-2 font-titre text-sm font-semibold tracking-wide text-or-clair uppercase">
          Stock restant par cadeau
        </h2>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stats.parCadeau.map((c) => ({
                nom: c.nom.length > 16 ? `${c.nom.slice(0, 15)}…` : c.nom,
                stock: c.stock,
                couleur: c.couleur,
                gagnes: c.gagnes,
              }))}
              margin={{ top: 6, right: 6, left: -22, bottom: 0 }}
            >
              <CartesianGrid stroke="rgba(232,198,106,0.1)" vertical={false} />
              <XAxis
                dataKey="nom"
                tick={{ fill: "#b9b0a2", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-18}
                textAnchor="end"
                height={54}
              />
              <YAxis
                tick={{ fill: "#b9b0a2", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={38}
              />
              <Tooltip
                contentStyle={{
                  background: "#121010",
                  border: "1px solid rgba(232,198,106,0.35)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                cursor={{ fill: "rgba(232,198,106,0.06)" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="stock" name="En stock" radius={[5, 5, 0, 0]}>
                {stats.parCadeau.map((c) => (
                  <Cell key={c.id} fill={c.couleur} />
                ))}
              </Bar>
              <Bar dataKey="gagnes" name="Gagnés" fill="rgba(232,198,106,0.35)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Carte>
    </div>
  );
}
