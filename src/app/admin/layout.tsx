import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { BarreAdmin } from "@/components/admin/BarreAdmin";
import { lireSessionAdmin } from "@/lib/session";

/**
 * ⚠️ IMPORTANT — `instant = false` sur tout l'espace admin.
 *
 * Cache Components prérend chaque route statiquement. Or l'admin lit des
 * cookies (session) ET affiche des données vivantes (stock, joueurs). Ces
 * pages ne peuvent donc pas avoir de « coquille » prérendue : elles doivent
 * bloquer leur rendu jusqu'à la requête (ce qui est aussi plus sûr : on ne
 * sert jamais un fragment de dashboard périmé).
 *
 * Le contrôle d'accès reste fait ici, côté serveur, AVANT tout rendu de
 * l'enfant : impossible de contourner en désactivant le JavaScript.
 */
export const instant = false;

export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const session = await lireSessionAdmin();
  if (!session) redirect("/connexion?suite=/admin");

  return (
    <div className="min-h-dvh bg-[#080706] text-creme">
      <BarreAdmin />
      <main className="mx-auto w-full max-w-7xl px-3 pb-16 sm:px-5 lg:pl-[16.5rem]">{children}</main>
    </div>
  );
}
