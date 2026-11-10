"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Gift,
  ImageIcon,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Power,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import {
  actionAjusterStock,
  actionBasculerActif,
  actionCreerCadeau,
  actionModifierCadeau,
  actionSupprimerCadeau,
  type EtatAction,
} from "@/app/admin/cadeaux/actions";
import { BoutonFantome, BoutonOr, Carte, Pastille } from "@/components/ui/Base";
import type { Cadeau } from "@/lib/types";

/**
 * Gestion du catalogue : liste + formulaire d'édition en panneau glissant.
 * Toutes les écritures passent par des Server Actions protégées.
 */
export function GestionCadeaux({ cadeaux }: { cadeaux: Cadeau[] }) {
  const [edition, setEdition] = useState<Cadeau | "nouveau" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const totalProbabilite = useMemo(
    () => cadeaux.filter((c) => c.actif).reduce((s, c) => s + c.probabilite, 0),
    [cadeaux],
  );
  const chanceDePerdre = Math.max(100 - totalProbabilite, 0);

  function signaler(etat: EtatAction) {
    if (etat.erreur) {
      setErreur(etat.erreur);
      setMessage(null);
    } else if (etat.message || etat.ok) {
      setMessage(etat.message ?? "Enregistré.");
      setErreur(null);
      setTimeout(() => setMessage(null), 3200);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Synthèse des probabilités */}
      <Carte className="!p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Pastille ton={totalProbabilite > 100 ? "rouge" : "or"}>
              Total des chances : {totalProbabilite.toFixed(1)} %
            </Pastille>
            <Pastille ton="neutre">Perdre : {chanceDePerdre.toFixed(1)} %</Pastille>
          </div>
          <BoutonOr className="!w-auto !px-4 !py-2.5 text-[13px]" onClick={() => setEdition("nouveau")}>
            <Plus className="size-4" /> Nouveau cadeau
          </BoutonOr>
        </div>
        {totalProbabilite > 100 && (
          <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-100">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            La somme dépasse 100 % : les chances sont renormalisées proportionnellement (aucun
            tirage perdant possible).
          </p>
        )}
      </Carte>

      <AnimatePresence>
        {(message || erreur) && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="status"
            className={`rounded-xl border px-3 py-2 text-[12.5px] ${
              erreur
                ? "border-bordeaux-clair/50 bg-bordeaux/25 text-rose-100"
                : "border-emeraude/40 bg-emeraude/10 text-emerald-100"
            }`}
          >
            {erreur ?? message}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Liste (cartes sur mobile, tableau sur desktop) */}
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {cadeaux.map((cadeau) => (
          <CarteCadeau
            key={cadeau.id}
            cadeau={cadeau}
            onEditer={() => setEdition(cadeau)}
            onSignaler={signaler}
          />
        ))}
        {cadeaux.length === 0 && (
          <Carte className="col-span-full py-12 text-center text-[13px] text-cendre/70">
            Aucun cadeau. Commencez par en ajouter un.
          </Carte>
        )}
      </div>

      <AnimatePresence>
        {edition && (
          <PanneauFormulaire
            cadeau={edition === "nouveau" ? null : edition}
            onFermer={() => setEdition(null)}
            onSucces={(msg) => {
              setEdition(null);
              setMessage(msg);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Carte d'un cadeau                                                        */
/* -------------------------------------------------------------------------- */
function CarteCadeau({
  cadeau,
  onEditer,
  onSignaler,
}: {
  cadeau: Cadeau;
  onEditer: () => void;
  onSignaler: (etat: EtatAction) => void;
}) {
  const [occupe, setOccupe] = useState(false);
  const [confirmSuppression, setConfirmSuppression] = useState(false);

  async function executer(action: () => Promise<EtatAction>) {
    setOccupe(true);
    try {
      onSignaler(await action());
    } catch {
      onSignaler({ erreur: "Action impossible." });
    } finally {
      setOccupe(false);
    }
  }

  return (
    <Carte
      className={`!p-3.5 transition-opacity ${cadeau.actif ? "" : "opacity-55"}`}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 text-xl"
          style={{ backgroundColor: `${cadeau.couleur}33` }}
        >
          {cadeau.image_url ? (
            <Image
              src={cadeau.image_url}
              alt={cadeau.nom}
              width={48}
              height={48}
              className="size-full object-cover"
              unoptimized
            />
          ) : (
            <span>{cadeau.icone}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[13.5px] font-semibold text-creme">{cadeau.nom}</h3>
            <span
              className="mt-1 size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: cadeau.couleur }}
              title={cadeau.couleur}
            />
          </div>
          <p className="mt-0.5 text-[11px] text-cendre/65">
            {cadeau.probabilite} % · {cadeau.stock} en stock
            {cadeau.gagnes_non_recuperes ? ` · ${cadeau.gagnes_non_recuperes} réservés` : ""}
          </p>

          {/* Stock +/- */}
          <div className="mt-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => executer(() => actionAjusterStock(cadeau.id, -1))}
              disabled={occupe || cadeau.stock === 0}
              className="flex size-7 items-center justify-center rounded-md border border-white/10 text-cendre hover:border-or/40 hover:text-or disabled:opacity-30"
              aria-label={`Retirer 1 au stock de ${cadeau.nom}`}
            >
              <Minus className="size-3.5" />
            </button>
            <span className="min-w-8 text-center text-[13px] font-semibold tabular-nums text-creme">
              {cadeau.stock}
            </span>
            <button
              type="button"
              onClick={() => executer(() => actionAjusterStock(cadeau.id, 1))}
              disabled={occupe}
              className="flex size-7 items-center justify-center rounded-md border border-white/10 text-cendre hover:border-or/40 hover:text-or disabled:opacity-30"
              aria-label={`Ajouter 1 au stock de ${cadeau.nom}`}
            >
              <Plus className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executer(() => actionAjusterStock(cadeau.id, 10))}
              disabled={occupe}
              className="ml-1 rounded-md border border-white/10 px-2 py-1 text-[10.5px] text-cendre hover:border-or/40 hover:text-or disabled:opacity-30"
            >
              +10
            </button>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => onEditer()}
                className="flex size-7 items-center justify-center rounded-md border border-white/10 text-cendre hover:border-or/40 hover:text-or"
                aria-label="Modifier"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executer(() => actionBasculerActif(cadeau.id, !cadeau.actif))}
                disabled={occupe}
                className={`flex size-7 items-center justify-center rounded-md border ${
                  cadeau.actif
                    ? "border-emeraude/40 text-emerald-300"
                    : "border-white/10 text-cendre/50"
                }`}
                aria-label={cadeau.actif ? "Désactiver" : "Activer"}
                title={cadeau.actif ? "Désactiver" : "Activer"}
              >
                <Power className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirmSuppression) {
                    setConfirmSuppression(true);
                    setTimeout(() => setConfirmSuppression(false), 4000);
                    return;
                  }
                  void executer(() => actionSupprimerCadeau(cadeau.id));
                }}
                disabled={occupe}
                className={`flex size-7 items-center justify-center rounded-md border ${
                  confirmSuppression
                    ? "border-bordeaux-clair bg-bordeaux/40 text-rose-200"
                    : "border-white/10 text-cendre/60 hover:border-bordeaux-clair/50 hover:text-rose-300"
                }`}
                aria-label={confirmSuppression ? "Confirmer la suppression" : "Supprimer"}
                title={confirmSuppression ? "Confirmer ?" : "Supprimer"}
              >
                {occupe ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              </button>
            </div>
          </div>

          {confirmSuppression && (
            <p className="mt-1.5 text-[10.5px] text-rose-200">
              Appuyez à nouveau sur la corbeille pour confirmer.
            </p>
          )}
        </div>
      </div>
    </Carte>
  );
}

/* -------------------------------------------------------------------------- */
/*  Panneau latéral : création / édition                                     */
/* -------------------------------------------------------------------------- */
const ICONES = ["🎁", "🎟️", "🧢", "🛍️", "🧴", "🖊️", "🌸", "💸", "☕", "🍫", "📱", "👕", "👟", "💄", "🌟"];
const COULEURS = [
  "#C9A227",
  "#8B1E3F",
  "#1F6F5C",
  "#B4552A",
  "#3A4A7A",
  "#6B4A7A",
  "#0F6B6B",
  "#A52A3F",
  "#4A3F35",
  "#2C6E49",
];

function PanneauFormulaire({
  cadeau,
  onFermer,
  onSucces,
}: {
  cadeau: Cadeau | null;
  onFermer: () => void;
  onSucces: (message: string) => void;
}) {
  const [etat, action, enAttente] = useActionState<EtatAction, FormData>(
    cadeau ? actionModifierCadeau : actionCreerCadeau,
    {},
  );

  const [couleur, setCouleur] = useState(cadeau?.couleur ?? COULEURS[0]);
  const [icone, setIcone] = useState(cadeau?.icone ?? "🎁");
  const [imageUrl, setImageUrl] = useState(cadeau?.image_url ?? "");
  const [imageCasse, setImageCasse] = useState(false);

  useEffect(() => {
    if (etat.ok) onSucces(etat.message ?? "Cadeau enregistré.");
  }, [etat, onSucces]);

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
      onClick={onFermer}
      role="dialog"
      aria-modal="true"
      aria-label={cadeau ? "Modifier le cadeau" : "Nouveau cadeau"}
    >
      <motion.div
        initial={{ x: 40, opacity: 0.6 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="h-full w-full max-w-md overflow-y-auto border-l border-or/20 bg-[#0d0b0a] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-titre text-lg font-semibold text-or-clair">
            {cadeau ? "Modifier le cadeau" : "Nouveau cadeau"}
          </h2>
          <button
            type="button"
            onClick={onFermer}
            className="rounded-lg border border-white/10 p-1.5 text-cendre hover:text-creme"
            aria-label="Fermer"
          >
            <ChevronDown className="size-4 rotate-90" />
          </button>
        </div>

        <form action={action} className="flex flex-col gap-4">
          {cadeau && <input type="hidden" name="id" value={cadeau.id} />}
          <input type="hidden" name="couleur" value={couleur} />
          <input type="hidden" name="icone" value={icone} />

          <div>
            <label htmlFor="nom" className="etiquette">
              Nom du cadeau
            </label>
            <input
              id="nom"
              name="nom"
              required
              defaultValue={cadeau?.nom ?? ""}
              className="champ"
              placeholder="Ex. Casquette boutique"
            />
          </div>

          <div>
            <label htmlFor="description" className="etiquette">
              Description (facultatif)
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={cadeau?.description ?? ""}
              className="champ resize-none"
              placeholder="Détail affiché sur la page résultat"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="stock" className="etiquette">
                Stock
              </label>
              <input
                id="stock"
                name="stock"
                type="number"
                min={0}
                required
                defaultValue={cadeau?.stock ?? 10}
                className="champ"
              />
            </div>
            <div>
              <label htmlFor="probabilite" className="etiquette">
                Probabilité %
              </label>
              <input
                id="probabilite"
                name="probabilite"
                type="number"
                min={0}
                max={100}
                step="0.5"
                required
                defaultValue={cadeau?.probabilite ?? 10}
                className="champ"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ordre" className="etiquette">
              Ordre sur la roue
            </label>
            <input
              id="ordre"
              name="ordre"
              type="number"
              min={0}
              max={999}
              defaultValue={cadeau?.ordre ?? 0}
              className="champ"
            />
          </div>

          {/* Couleur */}
          <div>
            <span className="etiquette">Couleur de la case</span>
            <div className="flex flex-wrap gap-2">
              {COULEURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCouleur(c)}
                  className={`size-8 rounded-full border-2 transition-transform ${
                    couleur === c ? "scale-110 border-white" : "border-white/15"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Couleur ${c}`}
                  aria-pressed={couleur === c}
                />
              ))}
              <input
                type="color"
                value={couleur}
                onChange={(e) => setCouleur(e.target.value)}
                className="size-8 cursor-pointer rounded-full border border-white/15 bg-transparent"
                aria-label="Couleur personnalisée"
              />
            </div>
          </div>

          {/* Icône */}
          <div>
            <span className="etiquette">Icône</span>
            <div className="flex flex-wrap gap-1.5">
              {ICONES.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcone(i)}
                  className={`flex size-9 items-center justify-center rounded-lg border text-lg ${
                    icone === i ? "border-or/70 bg-or/15" : "border-white/10 hover:border-white/25"
                  }`}
                  aria-pressed={icone === i}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="imageUrl" className="etiquette">
              Image du cadeau (URL, facultatif)
            </label>
            {/*
              Règle d'affichage de la roue : une case montre SOIT le texte, SOIT
              la photo. L'exploitant doit le savoir au moment de choisir, sinon
              il colle une image ET garde un nom long, et s'attend à voir les
              deux.
            */}
            <p className="mb-1.5 flex items-start gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[10.5px] leading-snug text-cendre/70">
              <ImageIcon className="mt-px size-3 shrink-0 text-or/70" />
              <span>
                Sur la roue, la case affiche <strong className="text-creme">soit la photo</strong>,{" "}
                <strong className="text-creme">soit le nom</strong> — jamais les deux. Avec une photo,
                le nom reste écrit dessus en petit.
              </span>
            </p>
            <input
              id="imageUrl"
              name="imageUrl"
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                setImageCasse(false);
              }}
              className="champ"
              placeholder="https://…/cadeau.jpg"
            />
            {imageUrl && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 p-2">
                {imageCasse ? (
                  <span className="flex items-center gap-1.5 text-[11px] text-amber-200">
                    <TriangleAlert className="size-3.5" /> Image introuvable
                  </span>
                ) : (
                  <>
                    <ImageIcon className="size-3.5 text-cendre/60" />
                    {/* Aperçu : balise img volontaire (URL arbitraire saisie par l'admin) */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Aperçu"
                      className="size-10 rounded object-cover"
                      onError={() => setImageCasse(true)}
                    />
                    <span className="text-[10.5px] text-cendre/55">Aperçu</span>
                  </>
                )}
              </div>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[12.5px] text-cendre">
            <input
              type="checkbox"
              name="actif"
              defaultChecked={cadeau ? cadeau.actif : true}
              className="size-4 accent-[#e8c66a]"
            />
            Cadeau actif (visible sur la roue)
          </label>

          {etat.erreur && (
            <p role="alert" className="rounded-xl border border-bordeaux-clair/50 bg-bordeaux/25 px-3 py-2 text-[12px] text-rose-100">
              {etat.erreur}
            </p>
          )}

          <div className="sticky bottom-0 -mx-5 mt-1 flex gap-2 border-t border-white/10 bg-[#0d0b0a]/95 px-5 py-3 backdrop-blur">
            <BoutonFantome type="button" onClick={onFermer} className="text-[13px]">
              Annuler
            </BoutonFantome>
            <BoutonOr type="submit" disabled={enAttente} className="!py-2.5 text-[13px]">
              {enAttente ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Enregistrement…
                </>
              ) : (
                <>
                  <Check className="size-4" /> {cadeau ? "Enregistrer" : "Ajouter"}
                </>
              )}
            </BoutonOr>
          </div>
        </form>

        <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-[11px] leading-relaxed text-cendre/60">
          <Gift className="mb-1 size-3.5 text-or/70" />
          Astuce : gardez plusieurs lots de petite valeur avec un stock élevé (stylos,
          échantillons) et un seul lot « vitrine » à faible probabilité. La roue reste crédible et
          le budget maîtrisé.
        </div>
      </motion.div>
    </motion.div>
  );
}
