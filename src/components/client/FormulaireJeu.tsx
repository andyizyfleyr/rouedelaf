"use client";

import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Lock, ShieldCheck } from "lucide-react";

import { BoutonOr, Carte, Pastille } from "@/components/ui/Base";
import { normaliserSource } from "@/lib/format";
import { deverrouillerAudio } from "@/lib/sons";
import { suivreEvenement } from "@/lib/pixel";
import { identifiantAppareil, entetesJeu } from "@/lib/appareil";

/**
 * Inscription en UN seul écran : nom + numéro WhatsApp + consentement.
 *
 * Historique : il y avait auparavant un code de vérification envoyé par
 * WhatsApp (OTP). Il a été retiré à la demande de l'exploitant : sans envoi
 * réel de message, il n'était qu'une friction inutile.
 *
 * Protection équivalente sans OTP :
 *  - une participation par numéro, appliquée par la base (contrainte UNIQUE) ;
 *  - l'écran de confirmation reprend le numéro saisi en entier : le client
 *    relit ce qu'il a tapé avant de valider (le « 2 tours » du téléphone est
 *    la principale source d'erreur) ;
 *  - un joueur qui saisit le numéro d'un autre ne peut pas lui voler son tour :
 *    le numéro étant déjà inscrit, on lui répond « déjà participé » et aucune
 *    session n'est ouverte ;
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
  const telephoneValide = chiffres.length >= 8;
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
    <Carte className="overflow-hidden">
      <motion.div
        initial={{ opacity: 0, x: -18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.24 }}
        className="flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <Pastille ton="or">
            <ShieldCheck className="size-3.5" /> Participation
          </Pastille>
          <span className="text-[11px] text-cendre/70">1 tour offert</span>
        </div>

        <div>
          <label htmlFor="nom" className="etiquette">
            Votre nom
          </label>
          <input
            id="nom"
            className="champ"
            placeholder="Ex. Adjoa"
            autoComplete="given-name"
            autoCapitalize="words"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            maxLength={80}
          />
        </div>

        <div>
          <label htmlFor="telephone" className="etiquette">
            Numéro WhatsApp
          </label>
          <div className="flex gap-2">
            <select
              aria-label="Indicatif pays"
              className="champ w-[104px] shrink-0 px-2 text-sm"
              value={indicatif}
              onChange={(e) => setIndicatif(e.target.value)}
            >
              <option value="229">🇧🇯 +229</option>
              <option value="228">🇹🇬 +228</option>
              <option value="234">🇳🇬 +234</option>
              <option value="225">🇨🇮 +225</option>
              <option value="226">🇧🇫 +226</option>
              <option value="221">🇸🇳 +221</option>
              <option value="33">🇫🇷 +33</option>
            </select>
            <input
              id="telephone"
              className="champ"
              placeholder="97 12 34 56"
              inputMode="tel"
              autoComplete="tel-national"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value.replace(/[^\d\s]/g, ""))}
              maxLength={18}
            />
          </div>

          {/* Relecture du numéro complet : le client vérifie qu'il n'a pas fait
              de faute de frappe, avant d'engager son unique tour. */}
          <p
            className={`mt-1.5 text-[12px] leading-relaxed ${
              telephoneValide ? "text-or-clair/90" : "text-cendre/65"
            }`}
          >
            {telephoneValide ? (
              <>
                Vérifiez :{" "}
                <strong className="font-semibold tabular-nums">
                  +{indicatif} {chiffres.replace(/(\d{2})(?=\d)/g, "$1 ").trim()}
                </strong>
              </>
            ) : (
              "Un seul tour par numéro. Nous vous contacterons sur ce numéro WhatsApp."
            )}
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-[12px] leading-relaxed text-cendre">
          <input
            type="checkbox"
            checked={consentement}
            onChange={(e) => setConsentement(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[#e8c66a]"
          />
          <span>
            J&apos;accepte de recevoir les offres de la boutique sur WhatsApp. Je peux me
            désinscrire à tout moment en répondant STOP.
          </span>
        </label>

        {erreur && <MessageErreur texte={erreur} />}

        <BoutonOr type="button" disabled={!pret} onClick={jouer}>
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

        <p className="text-center text-[11px] text-cendre/55">
          <Lock className="mr-1 inline size-3" />
          Nous ne partageons jamais votre numéro.
        </p>
      </motion.div>
    </Carte>
  );
}

function MessageErreur({ texte }: { texte: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      className="rounded-xl border border-bordeaux-clair/50 bg-bordeaux/25 px-3 py-2.5 text-[12.5px] leading-relaxed text-rose-100"
    >
      {texte}
    </motion.p>
  );
}
