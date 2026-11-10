"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Camera,
  CameraOff,
  Check,
  Gift,
  Keyboard,
  Loader2,
  ScanLine,
  TriangleAlert,
} from "lucide-react";

import {
  chercherCode,
  validerRemise,
  type ApercuCode,
  type ResultatRemise,
} from "@/app/admin/scan/actions";
import { BoutonFantome, BoutonOr, Carte, Pastille } from "@/components/ui/Base";

/**
 * Scanner de QR code (page /admin/scan).
 *
 * Choix techniques :
 *  - La caméra n'est ouverte QUE sur action de la vendeuse (autonomie de la
 *    batterie, pas de demande de permission surprise).
 *  - @zxing/browser est chargé dynamiquement : le bundle admin reste léger et
 *    le scanner ne pénalise pas les autres pages.
 *  - Après un scan, la caméra s'arrête (on ne flashe pas le client) et un
 *    aperçu s'affiche ; la vendeuse confirme.
 *  - Saisie manuelle toujours disponible (QR abîmé, écran cassé).
 */
export function ScannerCode() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [camera, setCamera] = useState(false);
  const [erreurCamera, setErreurCamera] = useState<string | null>(null);
  const [codeManuel, setCodeManuel] = useState("");
  const [apercu, setApercu] = useState<ApercuCode | null>(null);
  const [remise, setRemise] = useState<ResultatRemise | null>(null);
  const [chargement, setChargement] = useState(false);
  const dernierCode = useRef<string | null>(null);

  const arreterCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCamera(false);
  }, []);

  useEffect(() => () => arreterCamera(), [arreterCamera]);

  /** Analyse un code (scan ou saisie manuelle). */
  const analyser = useCallback(
    async (code: string) => {
      if (!code.trim()) return;
      setChargement(true);
      setRemise(null);
      arreterCamera();
      try {
        const resultat = await chercherCode(code);
        setApercu(resultat);
      } finally {
        setChargement(false);
      }
    },
    [arreterCamera],
  );

  async function demarrerCamera() {
    setErreurCamera(null);
    setApercu(null);
    setRemise(null);
    setCamera(true);

    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const lecteur = new BrowserQRCodeReader();

      controlsRef.current = await lecteur.decodeFromVideoDevice(
        // `undefined` = caméra arrière par défaut sur mobile.
        undefined,
        videoRef.current ?? undefined,
        (resultat, erreur) => {
          if (erreur) return; // erreurs de décodage normales image par image
          const texte = resultat?.getText();
          if (!texte || texte === dernierCode.current) return;
          dernierCode.current = texte;
          setCodeManuel(texte);
          void analyser(texte);
        },
      );
    } catch (e) {
      console.error("[scan] caméra", e);
      setCamera(false);
      setErreurCamera(
        "Impossible d'ouvrir la caméra. Autorisez l'accès puis réessayez (HTTPS obligatoire), ou saisissez le code à la main.",
      );
    }
  }

  async function confirmerRemise() {
    if (!apercu?.ok) return;
    setChargement(true);
    try {
      const resultat = await validerRemise(codeManuel);
      setRemise(resultat);
      if (resultat.ok) setApercu(null);
    } finally {
      setChargement(false);
    }
  }

  function reinitialiser() {
    setApercu(null);
    setRemise(null);
    setCodeManuel("");
    dernierCode.current = null;
  }

  return (
    <div className="flex flex-col gap-3 lg:max-w-2xl">
      {/* Zone caméra */}
      <Carte className="relative overflow-hidden !p-0">
        <div className="relative aspect-[4/3] w-full bg-black/60">
          <video
            ref={videoRef}
            className={`size-full object-cover ${camera ? "" : "hidden"}`}
            muted
            playsInline
          />

          {!camera && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <span className="flex size-14 items-center justify-center rounded-full border border-or/30 bg-or/10">
                <ScanLine className="size-6 text-or" />
              </span>
              <p className="max-w-[34ch] text-[12.5px] leading-relaxed text-cendre/75">
                Ouvrez la caméra et cadrez le QR code du ticket remis au client.
              </p>
              <BoutonOr className="!w-auto !px-5 !py-2.5 text-[13px]" onClick={demarrerCamera}>
                <Camera className="size-4" /> Ouvrir la caméra
              </BoutonOr>
            </div>
          )}

          {camera && (
            <>
              {/* Cadre de visée */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative size-[62%]">
                  {["top-0 left-0 border-t-2 border-l-2", "top-0 right-0 border-t-2 border-r-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"].map(
                    (classe) => (
                      <span key={classe} className={`absolute size-7 rounded-[4px] border-or ${classe}`} />
                    ),
                  )}
                  <motion.span
                    className="absolute inset-x-0 top-0 h-0.5 bg-or/80 shadow-[0_0_12px_2px_rgba(232,198,106,0.8)]"
                    animate={{ y: ["0%", "100%", "0%"] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={arreterCamera}
                className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/70 px-3 py-1.5 text-[11.5px] text-creme backdrop-blur"
              >
                <CameraOff className="size-3.5" /> Arrêter
              </button>
            </>
          )}
        </div>
      </Carte>

      {erreurCamera && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-amber-100">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {erreurCamera}
        </p>
      )}

      {/* Saisie manuelle */}
      <Carte className="!p-4">
        <label htmlFor="code" className="etiquette">
          <Keyboard className="mr-1 inline size-3.5" /> Saisie manuelle du code
        </label>
        <div className="flex gap-2">
          <input
            id="code"
            value={codeManuel}
            onChange={(e) => setCodeManuel(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && analyser(codeManuel)}
            placeholder="ROUE-XXXX-YY"
            className="champ font-mono tracking-wider"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <BoutonOr
            className="!w-auto shrink-0 !px-4 text-[13px]"
            disabled={chargement || codeManuel.length < 8}
            onClick={() => analyser(codeManuel)}
          >
            {chargement ? <Loader2 className="size-4 animate-spin" /> : "Vérifier"}
          </BoutonOr>
        </div>
      </Carte>

      {/* Résultat de la remise (succès) */}
      {remise?.ok && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
          <Carte className="!p-5 text-center ring-2 ring-emerald-400/40">
            <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-500/20">
              <Check className="size-6 text-emerald-300" />
            </span>
            <p className="font-titre text-lg font-semibold text-emerald-200">Cadeau remis</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-cendre">{remise.message}</p>
            <BoutonFantome className="mt-4 text-[12.5px]" onClick={reinitialiser}>
              Scanner un autre code
            </BoutonFantome>
          </Carte>
        </motion.div>
      )}

      {/* Échec de remise */}
      {remise && !remise.ok && (
        <Carte className="!p-5 ring-2 ring-rose-400/30">
          <p className="flex items-center gap-2 font-titre text-base font-semibold text-rose-200">
            <TriangleAlert className="size-5" /> Remise refusée
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-cendre">{remise.message}</p>
          <BoutonFantome className="mt-3 text-[12.5px]" onClick={reinitialiser}>
            Recommencer
          </BoutonFantome>
        </Carte>
      )}

      {/* Aperçu avant validation */}
      {apercu && (
        <Carte className="!p-5">
          {apercu.ok ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <Pastille ton="vert">
                  <Check className="size-3.5" /> Code valide
                </Pastille>
                <span className="font-mono text-[12px] text-cendre/70">{codeManuel}</span>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-full border border-or/30 bg-or/10">
                  <Gift className="size-5 text-or" />
                </span>
                <div>
                  <p className="font-titre text-lg font-semibold text-creme">{apercu.cadeauNom}</p>
                  {apercu.participantNom && (
                    <p className="text-[12.5px] text-cendre">pour {apercu.participantNom}</p>
                  )}
                </div>
              </div>

              <p className="mt-3 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-[11.5px] text-cendre/70">
                Vérifiez le cadeau avec le client puis remettez-le. Cette action est définitive
                et tracée.
              </p>

              <BoutonOr className="mt-4" disabled={chargement} onClick={confirmerRemise}>
                {chargement ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Enregistrement…
                  </>
                ) : (
                  <>
                    <Check className="size-4" /> Confirmer la remise
                  </>
                )}
              </BoutonOr>
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 font-titre text-base font-semibold text-amber-200">
                <TriangleAlert className="size-5" />
                {apercu.raison === "introuvable" && "Code inconnu"}
                {apercu.raison === "deja" && "Déjà remis"}
                {apercu.raison === "expire" && "Code expiré"}
                {apercu.raison === "perdu" && "Tirage perdant"}
                {apercu.raison === "auth" && "Session expirée"}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-cendre">
                {apercu.raison === "introuvable" &&
                  "Aucun cadeau ne correspond à ce code. Vérifiez la saisie."}
                {apercu.raison === "deja" &&
                  "Ce cadeau a déjà été retiré."}
                {apercu.raison === "expire" &&
                  "Le délai de retrait est dépassé. Voir avec le gérant pour une exception."}
                {apercu.raison === "perdu" &&
                  "Ce client n'a pas gagné de cadeau : il bénéficie seulement du bon de réduction."}
                {apercu.raison === "auth" && "Reconnectez-vous pour continuer."}
              </p>
              <BoutonFantome className="mt-3 text-[12.5px]" onClick={reinitialiser}>
                Recommencer
              </BoutonFantome>
            </>
          )}
        </Carte>
      )}
    </div>
  );
}
