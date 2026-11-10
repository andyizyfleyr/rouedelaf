import { Suspense } from "react";
import { redirect } from "next/navigation";

import { FormulaireConnexion } from "@/components/admin/FormulaireConnexion";
import { Carte, TitreOr } from "@/components/ui/Base";
import { lireSessionAdmin } from "@/lib/session";

export const metadata = { title: "Connexion administration" };

/**
 * /connexion — accès à l'espace boutique.
 *
 * Volontairement placée HORS du dossier /admin pour ne pas être protégée
 * par le garde-fou (sinon : boucle de redirection).
 *
 * Le formulaire reste une coquille statique : la vérification de session
 * (qui lit un cookie) est isolée dans un composant asynchrone sous
 * <Suspense>, ce qui permet à Next.js de servir la page instantanément.
 */
export default function PageConnexion({ searchParams }: PageProps<"/connexion">) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-or/35 bg-or/10 text-2xl">
          🔐
        </div>
        <TitreOr as="h1" className="text-2xl">
          Espace boutique
        </TitreOr>
        <p className="mt-2 text-[13px] text-cendre">
          Réservé à l&apos;équipe. Saisissez le mot de passe de la boutique.
        </p>
      </div>

      <Carte>
        <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-white/5" />}>
          <ZoneFormulaire searchParams={searchParams} />
        </Suspense>
      </Carte>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-cendre/45">
        Mot de passe défini par la variable ADMIN_PASSWORD (Vercel → Settings → Environment
        Variables).
      </p>
    </div>
  );
}

/** Lit la session (cookie) : placé sous Suspense pour ne pas bloquer la page. */
async function ZoneFormulaire({
  searchParams,
}: {
  searchParams: PageProps<"/connexion">["searchParams"];
}) {
  const session = await lireSessionAdmin();
  const { suite } = await searchParams;
  const cible = typeof suite === "string" && suite.startsWith("/admin") ? suite : "/admin";

  if (session) redirect(cible);

  return <FormulaireConnexion suite={cible} />;
}
