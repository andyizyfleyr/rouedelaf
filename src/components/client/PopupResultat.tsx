"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Gift,
  MapPin,
  MessageCircle,
  PartyPopper,
  QrCode as QrIcone,
  Share2,
  Ticket,
  TriangleAlert,
  X,
} from "lucide-react";

import { IconeCadeau } from "@/components/roue/IconeCadeau";
import { formatDateHeure, tempsRestant } from "@/lib/format";
import { lancerConfettis } from "@/lib/confettis";
import { suivreEvenement } from "@/lib/pixel";
import { jouerPerte, jouerVictoire } from "@/lib/sons";
import type { TirageResultat } from "@/lib/types";

/**
 * Résultat du tirage, en POPUP par-dessus la roue.
 *
 * Pourquoi une popup et non une page ?
 *  - la roue reste visible derrière : le joueur voit où l'aiguille s'est
 *    arrêtée, ce qui rend le résultat crédible ;
 *  - aucune redirection automatique : c'est le joueur qui appuie sur
 *    « Voir mon cadeau » quand il est prêt ;
 *  - une seule page à charger (aucun aller-retour réseau au moment où le
 *    résultat tombe, ce qui compte en 3G).
 *
 * La feuille `/resultat?t=…` continue d'exister : elle sert de lien direct
 * (retour depuis WhatsApp, historique) et de repli si le JavaScript est
 * désactivé.
 */
export function PopupResultat({
  tirage,
  qrDataUrl,
  messagePerdu,
  boutique,
  ouvert,
  onFermer,
  navigation,
}: {
  tirage: TirageResultat;
  qrDataUrl: string | null;
  messagePerdu: string;
  boutique: { nom: string; adresse: string; whatsapp: string };
  ouvert: boolean;
  onFermer: () => void;
  /**
   * Cadeaux précédent / suivant, quand le joueur en a gagné plusieurs.
   * Absent si un seul gain : on n'affiche alors aucune flèche.
   */
  navigation?: { position: number; total: number; precedent: () => void; suivant: () => void };
}) {
  const gagne = tirage.statut === "gagne";
  const panneau = useRef<HTMLDivElement>(null);
  const [copie, setCopie] = useState(false);
  /**
   * QR de secours : le serveur ne prépare que celui du dernier gain. Si le
   * joueur rouvre un cadeau PLUS ANCIEN, on le demande ici (une fois) pour
   * qu'il puisse toujours se présenter en boutique.
   */
  const [qrSecours, setQrSecours] = useState<string | null>(null);
  const qrAffiche = qrDataUrl ?? qrSecours;
  const [restant, setRestant] = useState<string | null>(null);
  const [expire, setExpire] = useState(false);

  // `expire`/`restant` dépendent de l'heure : calculés après le montage
  // (le rendu serveur ne doit jamais dépendre de Date.now()).
  useEffect(() => {
    const miseAJour = () => {
      setRestant(tempsRestant(tirage.expire_le));
      setExpire(new Date(tirage.expire_le).getTime() < Date.now());
    };
    const premier = setTimeout(miseAJour, 0);
    const id = setInterval(miseAJour, 30_000);
    return () => {
      clearTimeout(premier);
      clearInterval(id);
    };
  }, [tirage.expire_le]);

  // Effets déclenchés à l'OUVERTURE seulement (pas au montage) : confettis et
  // son ne doivent pas surgir sans que le joueur ait demandé le résultat.
  useEffect(() => {
    if (!ouvert) return;
    if (gagne) {
      lancerConfettis({ intense: false });
      jouerVictoire();
      suivreEvenement("joue_victoire", { cadeau: tirage.cadeau_nom, valeur: 0 });
    } else {
      jouerPerte();
    }
  }, [ouvert, gagne, tirage.cadeau_nom]);

  /**
   * Ouverture : Échap ferme, le fond ne défile plus, ET le focus entre dans
   * le dialogue. Sans ce dernier point, un utilisateur au clavier ou avec un
   * lecteur d'écran restait sur <body> et ne savait pas qu'une fenêtre
   * s'était ouverte (le contenu derrière restait annoncé).
   */
  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onFermer();
        return;
      }
      // Piège à focus : Tab ne sort jamais du panneau.
      if (e.key === "Tab" && panneau.current) {
        const focusables = panneau.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const premier = focusables[0];
        const dernier = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === premier) {
          e.preventDefault();
          dernier.focus();
        } else if (!e.shiftKey && document.activeElement === dernier) {
          e.preventDefault();
          premier.focus();
        }
      }
    };
    window.addEventListener("keydown", surTouche);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const id = setTimeout(() => panneau.current?.focus(), 80);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", surTouche);
      document.body.style.overflow = avant;
    };
  }, [ouvert, onFermer]);

  useEffect(() => {
    if (!ouvert || !gagne || !tirage.code_unique || qrDataUrl) return;
    let annule = false;
    (async () => {
      try {
        const res = await fetch(`/api/qr?code=${encodeURIComponent(tirage.code_unique ?? "")}`, {
          cache: "force-cache",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!annule && typeof data.qrDataUrl === "string") setQrSecours(data.qrDataUrl);
      } catch {
        /* réseau instable : le code reste affichable/copiable */
      }
    })();
    return () => {
      annule = true;
    };
  }, [ouvert, gagne, tirage.code_unique, qrDataUrl]);

  async function copierCode() {
    if (!tirage.code_unique) return;
    try {
      await navigator.clipboard.writeText(tirage.code_unique);
      setCopie(true);
      setTimeout(() => setCopie(false), 2200);
    } catch {
      /* presse-papiers indisponible : le code reste affiché */
    }
  }

  return (
    <AnimatePresence>
      {ouvert && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Voile sombre : la roue reste devinée derrière */}
          <button
            type="button"
            aria-label="Fermer le résultat"
            onClick={onFermer}
            className="absolute inset-0 bg-black/70 backdrop-blur-[3px]"
          />

          <motion.div
            ref={panneau}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={gagne ? "Votre cadeau" : "Votre résultat"}
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="carte-luxe popup-defilante relative z-10 max-h-[92dvh] w-full max-w-[480px] overflow-y-auto overscroll-contain rounded-b-none !p-4 sm:rounded-3xl"
          >
            {/* Poignée (indice de feuille glissante sur mobile) */}
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20 sm:hidden" />

            <button
              type="button"
              onClick={onFermer}
              aria-label="Fermer"
              className="absolute top-3 right-3 grid size-8 place-items-center rounded-full border border-white/10 bg-black/40 text-cendre/70 transition-colors hover:text-creme"
            >
              <X className="size-4" />
            </button>

            {/* Cadeau 1 / 2 : le joueur peut passer de l'un à l'autre */}
            {navigation && navigation.total > 1 && (
              <div className="mb-2 flex items-center justify-between gap-1 rounded-lg border border-or/20 bg-black/25 px-1 py-1">
                <button
                  type="button"
                  aria-label="Cadeau précédent"
                  onClick={navigation.precedent}
                  className="grid size-7 place-items-center rounded text-cendre/70 hover:text-creme"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="text-[10px] tracking-[0.14em] text-or-clair/80 uppercase">
                  Cadeau {navigation.position} / {navigation.total}
                </span>
                <button
                  type="button"
                  aria-label="Cadeau suivant"
                  onClick={navigation.suivant}
                  className="grid size-7 place-items-center rounded text-cendre/70 hover:text-creme"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}

            {/* En-tête */}
            <div className="flex items-center gap-2.5 pr-9">
              <motion.div
                initial={{ scale: 0.5, rotate: -14 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 14, delay: 0.1 }}
                className="grid size-10 shrink-0 place-items-center rounded-full border border-or/40 bg-or/10"
              >
                {gagne ? (
                  <PartyPopper className="size-5 text-or" />
                ) : (
                  <Ticket className="size-5 text-cendre" />
                )}
              </motion.div>
              <div className="min-w-0">
                <h2 className="texte-or font-titre text-[1.3rem] leading-tight font-bold uppercase">
                  {gagne ? (expire ? "Bon expiré" : "Vous avez gagné !") : "Pas de chance"}
                </h2>
                <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-cendre/80">
                  {gagne
                    ? expire
                      ? "Ce bon n'est plus valable en boutique."
                      : "Montrez ce code en boutique."
                    : messagePerdu}
                </p>
              </div>
            </div>

            {/* GAGNÉ : cadeau + code + QR */}
            {gagne && (
              <div className="mt-3 flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5">
                  {tirage.cadeau_image_url ? (
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-or/30">
                      <Image
                        src={tirage.cadeau_image_url}
                        alt={tirage.cadeau_nom ?? "Cadeau"}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <span className="grid size-14 shrink-0 place-items-center rounded-lg border border-or/25 bg-black/30">
                      <IconeCadeau
                        nom={tirage.cadeau_nom ?? "Cadeau"}
                        taille={26}
                        couleur="rgba(232,198,106,0.95)"
                      />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-titre text-[15px] leading-tight font-semibold text-creme">
                      {tirage.cadeau_nom ?? "Cadeau surprise"}
                    </p>
                    {tirage.cadeau_description && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-cendre/70">
                        {tirage.cadeau_description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 flex items-center gap-1 text-[9.5px] tracking-[0.14em] text-or/70 uppercase">
                      <QrIcone className="size-2.5" /> Code de retrait
                    </p>
                    <button
                      type="button"
                      onClick={copierCode}
                      disabled={expire || tirage.recupere}
                      className="group flex w-full items-center justify-center gap-1.5 rounded-lg border border-or/35 bg-black/40 px-2 py-2 transition-colors hover:border-or/60 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Copier mon code"
                    >
                      <span className="truncate font-mono text-[15px] font-bold tracking-[0.12em] text-or-clair">
                        {tirage.code_unique}
                      </span>
                      {copie ? (
                        <Check className="size-3.5 shrink-0 text-emerald-400" />
                      ) : (
                        <Copy className="size-3.5 shrink-0 text-or/60 group-hover:text-or" />
                      )}
                    </button>
                    <p className="mt-0.5 text-center text-[9px] tracking-wide text-cendre/45 uppercase">
                      {tirage.recupere
                        ? "Déjà retiré"
                        : expire
                          ? "Expiré"
                          : copie
                            ? "Copié !"
                            : "Appuyez pour copier"}
                    </p>
                  </div>

                  {qrAffiche && (
                    <div
                      className={`shrink-0 rounded-lg border border-or/30 bg-or-clair p-1 ${
                        expire || tirage.recupere ? "opacity-45 grayscale" : ""
                      }`}
                      title={expire || tirage.recupere ? "Bon non valable" : undefined}
                    >
                      {/* Data-URL générée par le serveur : <img> volontaire */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrAffiche}
                        alt={`QR code du cadeau ${tirage.code_unique}`}
                        width={86}
                        height={86}
                        className="size-[86px] rounded"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-start gap-1.5">
                    <CalendarClock className="mt-px size-3.5 shrink-0 text-or" />
                    <div className="min-w-0">
                      <p className="text-[9px] tracking-[0.1em] text-cendre/55 uppercase">
                        Avant le
                      </p>
                      <p className="leading-tight font-semibold text-creme">
                        {formatDateHeure(tirage.expire_le)}
                      </p>
                      {restant && !expire && (
                        <p className="text-[10px] text-or/75">{restant}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <MapPin className="mt-px size-3.5 shrink-0 text-or" />
                    <div className="min-w-0">
                      <p className="text-[9px] tracking-[0.1em] text-cendre/55 uppercase">
                        Retrait
                      </p>
                      <p className="leading-tight font-semibold text-creme">{boutique.nom}</p>
                      <p className="line-clamp-2 text-[10px] leading-snug text-cendre/60">
                        {boutique.adresse}
                      </p>
                    </div>
                  </div>
                </div>

                {(expire || tirage.recupere) && (
                  <p className="flex items-start gap-1.5 rounded-lg border border-bordeaux-clair/40 bg-bordeaux/20 px-2 py-1.5 text-[11px] leading-snug text-rose-100">
                    <TriangleAlert className="mt-px size-3 shrink-0" />
                    {tirage.recupere
                      ? "Ce cadeau a déjà été retiré."
                      : "Ce code a expiré. Passez nous voir, nous avons une attention."}
                  </p>
                )}
              </div>
            )}

            {/* PERDU : bon de consolation */}
            {!gagne && (
              <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-3 text-center">
                <p className="font-titre text-[2.6rem] leading-none font-bold text-or-clair">
                  −{tirage.reduction_consolation ?? 10}%
                </p>
                <p className="mt-1 text-[11.5px] text-cendre">sur votre prochain achat</p>
                <p className="mt-1.5 text-[10.5px] leading-snug text-cendre/60">
                  Montrez cet écran à la caisse · valable jusqu&apos;au{" "}
                  {formatDateHeure(tirage.expire_le)}
                </p>
              </div>
            )}

            {/* Partage + sorties */}
            <div className="mt-3 flex flex-col gap-1.5">
              <Partager compact />
              <div className="flex gap-1.5">
                <Link href="/roue" className="btn-fantome flex-1 !py-2.5 text-[12px]">
                  <Gift className="size-3.5" /> La roue
                </Link>
                <Link
                  href={`/resultat?t=${tirage.id}`}
                  className="btn-fantome flex-1 !py-2.5 text-[12px]"
                >
                  Plein écran
                </Link>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/*  Partage : +1 tour pour un ami qui s'inscrit                                */
/* -------------------------------------------------------------------------- */
function Partager({ compact = false }: { compact?: boolean }) {
  const [lien, setLien] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  async function charger() {
    setChargement(true);
    try {
      const res = await fetch("/api/parrainage");
      const data = await res.json();
      if (res.ok) {
        setLien(data.lien);
        setWhatsapp(data.whatsapp);
      }
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    const id = setTimeout(() => void charger(), 0);
    return () => clearTimeout(id);
  }, []);

  async function partager() {
    suivreEvenement("joue_partage", { bonus: true });
    if (navigator.share && lien) {
      try {
        await navigator.share({
          title: "Roue de la Fortune",
          text: "Tourne la roue et gagne un cadeau en boutique !",
          url: lien,
        });
        return;
      } catch {
        /* annulé : on bascule sur WhatsApp */
      }
    }
    if (whatsapp) window.open(whatsapp, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-emeraude/25 bg-emeraude/10 ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-full border border-emeraude/40 bg-emeraude/15">
        <Share2 className="size-3 text-emerald-300" />
      </span>
      <p className="min-w-0 flex-1 text-[10.5px] leading-snug text-cendre/80">
        Faites gagner un ami :{" "}
        <strong className="font-semibold text-or-clair">+1 tour</strong>
      </p>
      <button
        type="button"
        onClick={partager}
        disabled={chargement || !lien}
        className="btn-or shrink-0 !px-3 !py-1.5 text-[11.5px]"
      >
        <MessageCircle className="size-3.5" />
        {chargement ? "…" : "Partager"}
      </button>
    </div>
  );
}
