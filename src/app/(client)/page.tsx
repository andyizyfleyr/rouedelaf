import { Suspense } from "react";
import { redirect } from "next/navigation";

import { lireSessionJeu } from "@/lib/session";

/**
 * Racine du site : le client doit arriver sur /jouer.
 * S'il a déjà une session de jeu valide, on l'envoie directement sur sa roue.
 *
 * La lecture du cookie est isolée dans un composant sous <Suspense> : la
 * redirection s'exécute au moment de la requête, sans bloquer le prérendu de
 * la coquille (exigence de Cache Components).
 */
export default function Accueil() {
  return (
    <Suspense fallback={<Splash />}>
      <Redirection />
    </Suspense>
  );
}

/**
 * Composant de redirection : `redirect()` ne revient jamais, mais TypeScript
 * exige de renvoyer un nœud — d'où le `return null` inatteignable, explicite.
 */
async function Redirection(): Promise<never> {
  const session = await lireSessionJeu();
  redirect(session ? "/roue" : "/jouer");
}

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <span
        aria-hidden
        className="animate-scintille size-16 rounded-full border border-or-clair/70"
        style={{
          background:
            "conic-gradient(#e8c66a 0 45deg, #b3121f 45deg 90deg, #16402e 90deg 135deg, #e8c66a 135deg 180deg, #b3121f 180deg 225deg, #16402e 225deg 270deg, #e8c66a 270deg 315deg, #2f7a53 315deg 360deg)",
        }}
      />
      <p className="texte-or font-titre text-sm tracking-[0.24em] uppercase">
        Roue de Noël
      </p>
    </div>
  );
}
