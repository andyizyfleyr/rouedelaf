"use client";

import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Gift, Loader2, Lock, Sparkles, Trophy } from "lucide-react";

import { BoutonOr } from "@/components/ui/Base";
import { normaliserSource, telephoneLocalValide } from "@/lib/format";
import { deverrouillerAudio } from "@/lib/sons";
import { suivreEvenement } from "@/lib/pixel";
import { identifiantAppareil, entetesJeu } from "@/lib/appareil";

/**
 * Inscription en UN écran, volontairement COMPACTE.
 *
 * Sur un téléphone, tout doit tenir sans défilement : le client scanne un QR
 * en boutique, il ne doit pas avoir à faire défiler pour trouver le bouton.
 * D'où : champs de 44 px, indicatif collé au numéro sur la même ligne, pas de
 * paragraphe explicatif, une seule ligne de mention légale.
 *
 * Protection (l'OTP a été retiré à la demande de l'exploitant) :
 *  - une participation par numéro, garantie par la contrainte UNIQUE en base ;
 *  - le numéro complet est relu sous le champ avant validation (le « 2 tours »
 *    du téléphone est la principale source d'erreur) ;
 *  - limitation par IP et par appareil (Upstash) contre l'inscription en série.
 *
 * Aucune décision de jeu ici : on s'inscrit, puis on part sur /roue.
 */
export function FormulaireJeu() {
  const router = useRouter();
  const recherche = useSearchParams();
  const source = normaliserSource(recherche.get("src"));
  const ref = recherche.get("ref") ?? "";

  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [indicatif, setIndicatif] = useState("229");
  const [consentement, setConsentement] = useState(true);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Pixel Meta / TikTok : « début du jeu ».
  useEffect(() => {
    suivreEvenement("joue_debut", { source, parrainage: Boolean(ref) });
    identifiantAppareil();
  }, [source, ref]);

  const chiffres = telephone.replace(/\D/g, "");
  // ⚠ Ne pas se contenter de « au moins 8 chiffres » : sur +229, 10 chiffres
  // passaient et créaient un numéro inexistant. On vérifie la longueur
  // attendue pour l'indicatif choisi.
  const telephoneValide = telephoneLocalValide(indicatif, chiffres);
  const nomValide = nom.trim().length >= 2;
  const pret = nomValide && telephoneValide && consentement && !chargement;

  async function jouer() {
    setErreur(null);
    setChargement(true);
    // Débloque l'audio au geste utilisateur : les sons de la roue pourront
    // ensuite être joués sans intervention.
    deverrouillerAudio();

    try {
      const res = await fetch("/api/inscription", {
        method: "POST",
        headers: entetesJeu(),
        body: JSON.stringify({
          nom: nom.trim(),
          telephone: `${indicatif}${chiffres}`,
          source,
          ref: ref || undefined,
          consentement,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErreur(data.erreur ?? "Inscription impossible. Vérifiez vos informations.");
        return;
      }

      suivreEvenement("joue_inscription", { source, nom: nom.trim() });
      router.replace("/roue");
    } catch {
      setErreur("Problème de connexion. Vérifiez votre réseau puis réessayez.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="carte-luxe apparait overflow-hidden !p-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-3"
      >
        {/* Bandeau de réassurance : 3 promesses, une ligne, très petit */}
        <div className="grid grid-cols-3 divide-x divide-white/10 rounded-xl border border-white/[0.06] bg-white/[0.03] py-1.5">
          {[
            { icone: Gift, texte: "Cadeau" },
            { icone: Trophy, texte: "1 tour" },
            { icone: Sparkles, texte: "Immédiat" },
          ].map(({ icone: Icone, texte }) => (
            <div
              key={texte}
              className="flex items-center justify-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-or-clair/80 uppercase"
            >
              <Icone className="size-3" /> {texte}
            </div>
          ))}
        </div>

        <div>
          <label htmlFor="nom" className="etiquette !mb-1 !text-[10.5px]">
            Votre nom
          </label>
          <input
            id="nom"
            className="champ !py-2.5 !text-[15px]"
            placeholder="Ex. Adjoa"
            autoComplete="given-name"
            autoCapitalize="words"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            maxLength={80}
          />
        </div>

        <div>
          <label htmlFor="telephone" className="etiquette !mb-1 !text-[10.5px]">
            Numéro WhatsApp
          </label>
          {/* Indicatif et numéro sur UNE seule ligne : gain de 56 px de haut */}
          <div className="flex overflow-hidden rounded-xl border border-or/25 bg-[#0a0908]/80 focus-within:border-or/70 focus-within:ring-4 focus-within:ring-or/15">
            <select
              aria-label="Indicatif pays"
              className="shrink-0 appearance-none border-r border-or/20 bg-transparent px-2.5 text-[13px] font-semibold text-or-clair/90 outline-none"
              value={indicatif}
              onChange={(e) => setIndicatif(e.target.value)}
            >
              <option value="229">+229 Bénin</option>
              <option value="228">+228 Togo</option>
              <option value="234">+234 Nigéria</option>
              <option value="225">+225 Côte d&apos;Ivoire</option>
              <option value="226">+226 Burkina</option>
              <option value="221">+221 Sénégal</option>
              <option value="33">+33 France</option>
            </select>
            <input
              id="telephone"
              className="w-full bg-transparent px-3 py-2.5 text-[15px] tracking-wide text-creme outline-none placeholder:text-cendre/40"
              placeholder="97 12 34 56"
              inputMode="tel"
              autoComplete="tel-national"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value.replace(/[^\d\s]/g, ""))}
              maxLength={18}
            />
          </div>

          {/* Relecture du numéro complet avant d'engager l'unique tour */}
          <p
            className={`mt-1 text-[11px] leading-snug tabular-nums ${
              telephoneValide ? "text-or-clair/90" : "text-cendre/55"
            }`}
          >
            {telephoneValide ? (
              `Vérifiez : +${indicatif} ${chiffres.replace(/(\d{2})(?=\d)/g, "$1 ").trim()}`
            ) : chiffres.length > 0 ? (
              <span className="text-rose-200/85">
                {indicatif === "229" ? "Un numéro béninois compte 10 chiffres" : "Numéro incomplet"}
                {" — "}
                il doit en compter {indicatif === "229" ? "10" : "9 ou 10"}.
              </span>
            ) : (
              "Un seul tour par numéro."
            )}
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2 text-[10.5px] leading-snug text-cendre/75">
          <input
            type="checkbox"
            checked={consentement}
            onChange={(e) => setConsentement(e.target.checked)}
            className="mt-0.5 size-3.5 shrink-0 accent-[#e8c66a]"
          />
          <span>
            J&apos;accepte les offres de la boutique sur WhatsApp.{" "}
            <span className="text-cendre/50">STOP pour se désinscrire.</span>
          </span>
        </label>

        {erreur && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            role="alert"
            className="rounded-lg border border-bordeaux-clair/50 bg-bordeaux/25 px-2.5 py-2 text-[11.5px] leading-snug text-rose-100"
          >
            {erreur}
          </motion.p>
        )}

        <BoutonOr type="button" disabled={!pret} onClick={jouer} className="!py-3 text-[15px]">
          {chargement ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Un instant…
            </>
          ) : (
            <>
              Tourner la roue <ArrowRight className="size-4" />
            </>
          )}
        </BoutonOr>

        <p className="flex items-center justify-center gap-1 text-center text-[10px] text-cendre/45">
          <Lock className="size-2.5" />
          Numéro jamais partagé · Retrait en boutique
        </p>
      </motion.div>
    </div>
  );
}
