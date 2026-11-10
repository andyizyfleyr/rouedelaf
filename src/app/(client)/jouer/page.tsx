import { Suspense } from "react";
import { redirect } from "next/navigation";

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

  // Déjà joué et plus de tour disponible → on l'envoie voir son résultat.
  if (session) {
    const [dernier] = await sql`
      SELECT id FROM tirages WHERE participant_id = ${session.participantId}
      ORDER BY created_at DESC, id DESC LIMIT 1
    `;
    if (dernier) redirect(`/resultat?t=${dernier.id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-or/30 bg-or/5 px-3 py-1 text-[11px] tracking-[0.2em] text-or-clair uppercase">
          🎁 Cadeaux à gagner
        </p>
        <h1 className="texte-or-anime font-titre text-[2rem] leading-[1.1] font-bold tracking-tight uppercase sm:text-[2.4rem]">
          Tournez la roue
        </h1>
        <p className="mx-auto mt-3 max-w-[38ch] text-sm leading-relaxed text-cendre">
          Entrez votre nom et votre numéro WhatsApp, puis tentez de gagner un
          cadeau à retirer chez <strong className="text-creme">{boutique.nom}</strong>.
        </p>
      </header>

      <FormulaireJeu />
    </div>
  );
}

function SqueletteFormulaire() {
  return (
    <div className="carte-luxe h-[420px] animate-pulse" aria-hidden />
  );
}
