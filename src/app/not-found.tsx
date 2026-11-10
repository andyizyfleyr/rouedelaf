import Link from "next/link";

import { Carte, TitreOr } from "@/components/ui/Base";

export const metadata = { title: "Page introuvable" };

/** 404 personnalisée, cohérente avec l'univers du jeu. */
export default function Introuvable() {
  return (
    <div className="fond-velours mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <Carte className="text-center">
        <p className="text-5xl">🎡</p>
        <TitreOr as="h1" className="mt-3 text-xl">
          Page introuvable
        </TitreOr>
        <p className="mt-2 text-[13px] leading-relaxed text-cendre">
          La roue ne s&apos;arrête pas ici. Le lien est peut-être expiré.
        </p>
        <Link href="/roue" className="btn-or mt-5 w-full">
          Revenir à la roue
        </Link>
      </Carte>
    </div>
  );
}
