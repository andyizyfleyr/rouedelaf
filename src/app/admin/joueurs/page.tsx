import { Suspense } from "react";

import { TableJoueurs } from "@/components/admin/TableJoueurs";
import { TitreOr } from "@/components/ui/Base";
import { listerJoueurs } from "@/server/data";

export const metadata = { title: "Joueurs" };

/**
 * /admin/joueurs — liste des participants, recherche, export CSV et export
 * « campagne WhatsApp » (numéros prêts à coller dans un groupe diffusé).
 */
export default function PageJoueurs({
  searchParams,
}: PageProps<"/admin/joueurs">) {
  return (
    <div className="py-5">
      <header className="mb-4">
        <p className="text-[11px] tracking-[0.2em] text-or/70 uppercase">Clients</p>
        <TitreOr as="h1" className="mt-1 text-2xl sm:text-3xl">
          Joueurs
        </TitreOr>
        <p className="mt-2 max-w-[70ch] text-[12.5px] leading-relaxed text-cendre/75">
          Chaque numéro WhatsApp n&apos;a qu&apos;une seule participation. Exportez les numéros
          pour vos campagnes : les fichiers restent sur votre appareil (aucun e-mail, aucun
          transfert).
        </p>
      </header>

      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/5" />}>
        <Contenu searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenu({
  searchParams,
}: {
  searchParams: PageProps<"/admin/joueurs">["searchParams"];
}) {
  const param = await searchParams;
  const recherche = typeof param.q === "string" ? param.q : "";
  const source = typeof param.src === "string" ? param.src : "tous";
  const page = Number(typeof param.page === "string" ? param.page : 1) || 1;

  const { joueurs, total } = await listerJoueurs({
    recherche,
    source,
    page,
    limite: 50,
  });

  return (
    <TableJoueurs
      joueurs={joueurs}
      total={total}
      page={page}
      recherche={recherche}
      source={source}
    />
  );
}
