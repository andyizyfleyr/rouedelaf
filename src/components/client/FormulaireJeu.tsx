"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Lock, MessageCircle, ShieldCheck } from "lucide-react";

import { BoutonOr, BoutonFantome, Carte, Pastille } from "@/components/ui/Base";
import { normaliserSource } from "@/lib/format";
import { deverrouillerAudio } from "@/lib/sons";
import { suivreEvenement } from "@/lib/pixel";
import { identifiantAppareil, entetesJeu } from "@/lib/appareil";

/**
 * Parcours d'inscription en 2 écrans :
 *   1. Nom + numéro WhatsApp + consentement
 *   2. Code à 6 chiffres reçu sur WhatsApp
 *
 * Aucune décision de jeu ici : on s'inscrit, on vérifie, on part sur /roue.
 */
type Etape = "formulaire" | "code";

export function FormulaireJeu() {
  const router = useRouter();
  const recherche = useSearchParams();
  const source = normaliserSource(recherche.get("src"));
  const ref = recherche.get("ref") ?? "";

  const [etape, setEtape] = useState<Etape>("formulaire");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [indicatif, setIndicatif] = useState("229");
  const [consentement, setConsentement] = useState(true);
  const [code, setCode] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [secondes, setSecondes] = useState(0);
  const [codeDeTest, setCodeDeTest] = useState<string | null>(null);
  const champCode = useRef<HTMLInputElement>(null);

  // Pixel Meta / TikTok : « début du jeu ».
  useEffect(() => {
    suivreEvenement("joue_debut", { source, parrainage: Boolean(ref) });
    identifiantAppareil();
  }, [source, ref]);

  // Compte à rebours avant de pouvoir renvoyer un code.
  useEffect(() => {
    if (secondes <= 0) return;
    const id = setInterval(() => setSecondes((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(id);
  }, [secondes]);

  async function envoyerCode(nouveau = false) {
    setErreur(null);
    setInfo(null);
    setChargement(true);
    deverrouillerAudio();

    try {
      if (!nouveau) {
        // 1) Inscription (ou détection « déjà participé »).
        const res = await fetch("/api/inscription", {
          method: "POST",
          headers: entetesJeu(),
          body: JSON.stringify({
            nom: nom.trim(),
            telephone: `${indicatif}${telephone.replace(/\D/g, "")}`,
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
      }

      // 2) Envoi du code OTP par WhatsApp.
      const resCode = await fetch("/api/otp/envoyer", {
        method: "POST",
        headers: entetesJeu(),
        body: JSON.stringify({ telephone: `${indicatif}${telephone.replace(/\D/g, "")}` }),
      });
      const dataCode = await resCode.json();
      if (!resCode.ok) {
        setErreur(dataCode.erreur ?? "Impossible d'envoyer le code.");
        return;
      }

      setEtape("code");
      setSecondes(60);
      setInfo("Code envoyé sur WhatsApp.");
      if (dataCode.codeDeTest) {
        setCodeDeTest(String(dataCode.codeDeTest));
      } else {
        setCodeDeTest(null);
      }
      setTimeout(() => champCode.current?.focus(), 320);
    } catch {
      setErreur("Problème de connexion. Vérifiez votre réseau puis réessayez.");
    } finally {
      setChargement(false);
    }
  }

  async function verifierCode() {
    setErreur(null);
    setChargement(true);

    try {
      const res = await fetch("/api/otp/verifier", {
        method: "POST",
        headers: entetesJeu(),
        body: JSON.stringify({
          telephone: `${indicatif}${telephone.replace(/\D/g, "")}`,
          code,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.erreur ?? "Code incorrect.");
        return;
      }
      // Session posée : direction la roue.
      router.replace("/roue");
    } catch {
      setErreur("Problème de connexion. Réessayez.");
    } finally {
      setChargement(false);
    }
  }

  const telephoneValide = telephone.replace(/\D/g, "").length >= 8;
  const nomValide = nom.trim().length >= 2;

  return (
    <Carte className="overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        {etape === "formulaire" ? (
          <motion.div
            key="formulaire"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.24 }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <Pastille ton="or">
                <ShieldCheck className="size-3.5" /> Étape 1 / 2
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
              <p className="mt-1.5 text-[11px] leading-relaxed text-cendre/65">
                Un seul tour par numéro. Votre numéro sert à vous envoyer le code et nos offres.
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

            <BoutonOr
              type="button"
              disabled={!nomValide || !telephoneValide || !consentement || chargement}
              onClick={() => envoyerCode(false)}
            >
              {chargement ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Envoi du code…
                </>
              ) : (
                <>
                  Recevoir mon code <ArrowRight className="size-4" />
                </>
              )}
            </BoutonOr>

            <p className="text-center text-[11px] text-cendre/55">
              <Lock className="mr-1 inline size-3" />
              Nous ne partageons jamais votre numéro.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="code"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            transition={{ duration: 0.24 }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <Pastille ton="or">
                <MessageCircle className="size-3.5" /> Étape 2 / 2
              </Pastille>
              <span className="text-[11px] text-cendre/70">
                {indicatif === "229" ? "+229" : `+${indicatif}`} {telephone}
              </span>
            </div>

            <div className="text-center">
              <h2 className="font-titre text-lg font-semibold tracking-wide text-or-clair">
                Entrez le code reçu
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-cendre">
                Un code à 6 chiffres vous a été envoyé sur WhatsApp. Il expire dans 10 minutes.
              </p>
            </div>

            <CodeSaisie
              valeur={code}
              onChange={setCode}
              ref={champCode}
              onValider={() => code.length === 6 && verifierCode()}
            />

            {codeDeTest && (
              <p className="rounded-xl border border-emeraude/40 bg-emeraude/10 px-3 py-2 text-center text-[12px] text-emerald-200">
                Mode développement : code = <strong>{codeDeTest}</strong>
              </p>
            )}

            {erreur && <MessageErreur texte={erreur} />}
            {info && !erreur && (
              <p className="rounded-xl border border-or/25 bg-or/5 px-3 py-2 text-center text-[12px] text-or-clair">
                {info}
              </p>
            )}

            <BoutonOr
              type="button"
              disabled={code.length !== 6 || chargement}
              onClick={verifierCode}
            >
              {chargement ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Vérification…
                </>
              ) : (
                <>
                  <Check className="size-4" /> Vérifier mon code
                </>
              )}
            </BoutonOr>

            <div className="flex items-center justify-between gap-3">
              <BoutonFantome
                type="button"
                className="text-[13px]"
                onClick={() => {
                  setEtape("formulaire");
                  setCode("");
                  setErreur(null);
                }}
              >
                <ArrowLeft className="size-3.5" /> Modifier
              </BoutonFantome>
              <BoutonFantome
                type="button"
                className="text-[13px]"
                disabled={secondes > 0 || chargement}
                onClick={() => envoyerCode(true)}
              >
                {secondes > 0 ? `Renvoyer (${secondes} s)` : "Renvoyer le code"}
              </BoutonFantome>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Carte>
  );
}

/** Six cases de saisie → un seul input caché (clavier numérique natif). */
function CodeSaisie({
  valeur,
  onChange,
  onValider,
  ref,
}: {
  valeur: string;
  onChange: (v: string) => void;
  onValider: () => void;
  ref: React.RefObject<HTMLInputElement | null>;
}) {
  const chiffres = valeur.padEnd(6, " ").slice(0, 6).split("");
  return (
    <div className="relative">
      <input
        ref={ref}
        value={valeur}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onKeyDown={(e) => e.key === "Enter" && onValider()}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        aria-label="Code à 6 chiffres"
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />
      <div className="pointer-events-none flex justify-between gap-2">
        {chiffres.map((c, i) => (
          <div
            key={i}
            className={`flex h-14 flex-1 items-center justify-center rounded-xl border text-xl font-bold transition-colors ${
              c.trim()
                ? "border-or/70 bg-or/10 text-or-clair"
                : "border-or/20 bg-black/40 text-cendre/40"
            } ${valeur.length === i ? "border-or/80 shadow-[0_0_0_3px_rgba(232,198,106,0.14)]" : ""}`}
          >
            {c.trim() ? c : "•"}
          </div>
        ))}
      </div>
    </div>
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
