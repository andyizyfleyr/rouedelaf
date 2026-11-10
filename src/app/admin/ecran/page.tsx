import { Suspense } from "react";
import { redirect } from "next/navigation";

import { EcranBoutique } from "@/components/admin/EcranBoutique";
import { lireSessionAdmin } from "@/lib/session";

export const metadata = { title: "Écran boutique" };

/**
 * /admin/ecran — écran géant (TV ou tablette) affichant les derniers gagnants.
 * Conçu pour être laissé en plein écran en boutique : typographie très grande,
 * mise à jour automatique, aucune interaction nécessaire.
 */
export default function PageEcran({ searchParams }: PageProps<"/admin/ecran">) {
  return (
    <Suspense fallback={<FondEcran />}>
      <Contenu searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenu({
  searchParams,
}: {
  searchParams: PageProps<"/admin/ecran">["searchParams"];
}) {
  const session = await lireSessionAdmin();
  if (!session) redirect("/connexion?suite=/admin/ecran");

  const parametres = await searchParams;
  return <EcranBoutique modeHtml={parametres.mode === "html"} />;
}

function FondEcran() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <p className="texte-or font-titre text-2xl tracking-[0.14em] uppercase">Chargement…</p>
    </div>
  );
}
