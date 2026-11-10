"use client";

import { useActionState } from "react";
import { Check, Clock, History, Loader2, Power } from "lucide-react";

import {
  actionEnregistrerReglages,
  type EtatReglages,
} from "@/app/admin/reglages/actions";
import { BoutonOr, Carte, Pastille } from "@/components/ui/Base";
import { formatDateHeure } from "@/lib/format";
import type { LigneJournal } from "@/server/audit";
import type { Parametres } from "@/server/params";

/** Formulaire des réglages du jeu + journal d'audit. */
export function FormulaireReglages({
  parametres,
  journal,
}: {
  parametres: Parametres;
  journal: LigneJournal[];
}) {
  const [etat, action, enAttente] = useActionState<EtatReglages, FormData>(
    actionEnregistrerReglages,
    {},
  );

  return (
    <div className="grid gap-3 lg:grid-cols-5">
      <Carte className="lg:col-span-3">
        <form action={action} className="flex flex-col gap-4">
          {/* Interrupteur général */}
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-or/25 bg-or/5 px-3.5 py-3">
            <span className="flex items-center gap-2.5">
              <Power className={`size-4 ${parametres.activeJeu ? "text-emerald-400" : "text-rose-400"}`} />
              <span>
                <span className="block text-[13px] font-semibold text-creme">Jeu ouvert</span>
                <span className="block text-[11px] text-cendre/65">
                  Décochez pour suspendre les tirages (maintenance, rupture de stock).
                </span>
              </span>
            </span>
            <input
              type="checkbox"
              name="activeJeu"
              defaultChecked={parametres.activeJeu}
              className="size-5 accent-[#e8c66a]"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Champ
              name="toursMax"
              libelle="Tours par participant"
              valeur={parametres.toursMax}
              min={1}
              max={10}
              aide="1 = une seule participation par numéro"
            />
            <Champ
              name="toursBonusParrainage"
              libelle="Tours bonus (parrainage)"
              valeur={parametres.toursBonusParrainage}
              min={0}
              max={10}
              aide="Accordés quand un ami s'inscrit avec le lien"
            />
            <Champ
              name="dureeValiditeCodeJours"
              libelle="Validité du code cadeau (jours)"
              valeur={parametres.dureeValiditeCodeJours}
              min={1}
              max={365}
              aide="Délai de retrait en boutique"
            />
            <Champ
              name="dureeSessionMinutes"
              libelle="Durée de session (minutes)"
              valeur={parametres.dureeSessionMinutes}
              min={15}
              max={720}
              aide="Temps pour finir de jouer après vérification"
            />
            <Champ
              name="reductionConsolation"
              libelle="Réduction consolation (%)"
              valeur={parametres.reductionConsolation}
              min={0}
              max={100}
              aide="Offert aux perdants"
            />
          </div>

          <div>
            <label htmlFor="messagePerdu" className="etiquette">
              Message aux perdants
            </label>
            <textarea
              id="messagePerdu"
              name="messagePerdu"
              rows={3}
              defaultValue={parametres.messagePerdu}
              className="champ resize-none"
              maxLength={500}
            />
          </div>

          {etat.erreur && (
            <p role="alert" className="rounded-xl border border-bordeaux-clair/50 bg-bordeaux/25 px-3 py-2 text-[12px] text-rose-100">
              {etat.erreur}
            </p>
          )}
          {etat.ok && (
            <p role="status" className="rounded-xl border border-emeraude/40 bg-emeraude/10 px-3 py-2 text-[12px] text-emerald-100">
              {etat.message}
            </p>
          )}

          <BoutonOr type="submit" disabled={enAttente} className="sm:max-w-xs">
            {enAttente ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Enregistrement…
              </>
            ) : (
              <>
                <Check className="size-4" /> Enregistrer les réglages
              </>
            )}
          </BoutonOr>
        </form>
      </Carte>

      {/* Journal d'audit */}
      <Carte className="lg:col-span-2 !p-4">
        <h2 className="mb-3 flex items-center gap-2 font-titre text-sm font-semibold tracking-wide text-or-clair uppercase">
          <History className="size-4" /> Journal
        </h2>
        <ul className="flex max-h-[520px] flex-col gap-2 overflow-y-auto pr-1">
          {journal.length === 0 && (
            <li className="py-6 text-center text-[12px] text-cendre/55">Aucune activité.</li>
          )}
          {journal.map((ligne) => (
            <li key={ligne.id} className="border-l border-or/20 pl-2.5">
              <p className="text-[12px] font-medium text-creme">{libelleAction(ligne.action)}</p>
              <p className="text-[10.5px] text-cendre/50">
                <Clock className="mr-1 inline size-2.5" />
                {formatDateHeure(ligne.created_at)}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pastille ton="neutre">Tracé : connexions, remises, catalogue</Pastille>
        </div>
      </Carte>
    </div>
  );
}

function Champ({
  name,
  libelle,
  valeur,
  min,
  max,
  aide,
}: {
  name: string;
  libelle: string;
  valeur: number;
  min: number;
  max: number;
  aide: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="etiquette">
        {libelle}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        min={min}
        max={max}
        defaultValue={valeur}
        className="champ"
      />
      <p className="mt-1 text-[10.5px] text-cendre/50">{aide}</p>
    </div>
  );
}

function libelleAction(action: string): string {
  const libelles: Record<string, string> = {
    connexion_admin: "Connexion administrateur",
    connexion_admin_echec: "Échec de connexion",
    remise_cadeau: "Cadeau remis en boutique",
    cadeau_cree: "Cadeau ajouté",
    cadeau_modifie: "Cadeau modifié",
    reglages_modifies: "Réglages modifiés",
  };
  return libelles[action] ?? action;
}
