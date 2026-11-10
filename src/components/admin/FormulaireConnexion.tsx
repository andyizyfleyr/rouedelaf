"use client";

import { useActionState } from "react";
import { Loader2, LogIn } from "lucide-react";

import { connecterAdmin, type EtatConnexion } from "@/app/connexion/actions";
import { BoutonOr } from "@/components/ui/Base";

/** Formulaire de connexion (Server Action + useActionState). */
export function FormulaireConnexion({ suite }: { suite: string }) {
  const [etat, action, enAttente] = useActionState<EtatConnexion, FormData>(connecterAdmin, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="suite" value={suite} />

      <div>
        <label htmlFor="motDePasse" className="etiquette">
          Mot de passe
        </label>
        <input
          id="motDePasse"
          name="motDePasse"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          className="champ"
          placeholder="••••••••"
        />
      </div>

      {etat.erreur && (
        <p
          role="alert"
          className="rounded-xl border border-bordeaux-clair/50 bg-bordeaux/25 px-3 py-2.5 text-[12.5px] text-rose-100"
        >
          {etat.erreur}
        </p>
      )}

      <BoutonOr type="submit" disabled={enAttente}>
        {enAttente ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Vérification…
          </>
        ) : (
          <>
            <LogIn className="size-4" /> Entrer
          </>
        )}
      </BoutonOr>
    </form>
  );
}
