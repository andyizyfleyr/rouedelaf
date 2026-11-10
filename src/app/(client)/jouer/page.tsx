import { Suspense } from "react";
import Link from "next/link";
import { Gift, MapPin, Sparkles, Ticket } from "lucide-react";

import { FormulaireJeu } from "@/components/client/FormulaireJeu";
import { boutique } from "@/lib/env";
import { lireSessionJeu } from "@/lib/session";
import { sql } from "@/lib/db";

export const metadata = {
  title: "Tentez votre chance",
  description: "Inscrivez-vous et tournez la roue pour gagner un cadeau en boutique.",
};

/**
 * /jouer — point d'entrée du client (QR code en boutique, lien Facebook…).
 *
 * Le paramètre `?src=` (facebook, tiktok, boutique…) est transmis à
 * l'inscription pour mesurer l'origine des joueurs.
 * Le paramètre `?ref=` contient le code de parrainage d'un ami.
 */
export default function PageJouer() {
  return (
    <Suspense fallback={<SqueletteFormulaire />}>
      <Contenu />
    </Suspense>
  );
}

async function Contenu() {
  const session = await lireSessionJeu();

  // Déjà inscrit ? On ne redirige PAS de force : le joueur reste maître de sa
  // navigation (une redirection surprise donnait l'impression que le site se
  // fermait tout seul). S'il a déjà joué, il voit simplement un lien.
  let dejaJoue = false;
  if (session) {
    const [dernier] = await sql`
      SELECT id FROM tirages WHERE participant_id = ${session.participantId}
      ORDER BY created_at DESC, id DESC LIMIT 1
    `;
    dejaJoue = Boolean(dernier);
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* Accroche volontairement courte : le formulaire doit être visible
          sans défilement sur un écran de 640 px de haut. */}
      <header className="text-center">
        <h1 className="texte-or-anime font-titre text-[1.65rem] leading-[1.05] font-bold tracking-tight uppercase sm:text-[1.95rem]">
          Tournez la roue
        </h1>
        <p className="mx-auto mt-1 flex items-center justify-center gap-1.5 text-[12px] text-cendre">
          <Gift className="size-3.5 text-or" />
          Un cadeau à gagner chez{" "}
          <strong className="font-semibold text-creme">{boutique.nom}</strong>
        </p>
      </header>

      {dejaJoue ? (
        <div className="carte-luxe flex flex-col gap-2.5 !p-4 text-center">
          <p className="font-titre text-[15px] font-semibold text-creme">
            Vous avez déjà participé
          </p>
          <p className="text-[11.5px] leading-snug text-cendre/75">
            Votre résultat vous attend. Une seule participation par numéro.
          </p>
          <div className="flex gap-1.5">
            <Link href="/roue" className="btn-or flex-1 !py-2.5 text-[12.5px]">
              Revoir mon résultat
            </Link>
          </div>
        </div>
      ) : (
        <FormulaireJeu />
      )}

      {/* Trois promesses en une ligne, pas trois paragraphes */}
      <ul className="grid grid-cols-3 gap-1.5 text-center">
        {[
          { icone: Ticket, titre: "1 tour", detail: "par numéro" },
          { icone: Sparkles, titre: "100 %", detail: "gagnant" },
          { icone: MapPin, titre: "Retrait", detail: "en boutique" },
        ].map(({ icone: Icone, titre, detail }) => (
          <li
            key={titre}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-1 py-2"
          >
            <Icone className="mx-auto size-3.5 text-or/80" />
            <p className="mt-1 text-[11px] leading-none font-bold text-creme">{titre}</p>
            <p className="mt-0.5 text-[9.5px] leading-none text-cendre/55">{detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SqueletteFormulaire() {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="mx-auto h-7 w-56 animate-pulse rounded-lg bg-white/5" />
      <div className="carte-luxe h-[330px] animate-pulse" aria-hidden />
      <div className="h-14 animate-pulse rounded-xl bg-white/5" />
    </div>
  );
}
