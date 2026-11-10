"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarClock,
  Check,
  Copy,
  Gift,
  MapPin,
  MessageCircle,
  PartyPopper,
  QrCode as QrIcone,
  Share2,
  Ticket,
  TriangleAlert,
} from "lucide-react";

import { IconeCadeau } from "@/components/roue/IconeCadeau";
import { BoutonOr, Carte, Pastille, TitreOr } from "@/components/ui/Base";
import { formatDateHeure, tempsRestant } from "@/lib/format";
import { suivreEvenement } from "@/lib/pixel";
import { jouerPerte, jouerVictoire } from "@/lib/sons";
import type { TirageResultat } from "@/lib/types";

/**
 * Écran de fin : gagné (cadeau + code + QR) ou perdu (message + bon de
 * réduction de consolation). Inclut le partage « 1 tour en plus ».
 */
export function EcranResultat({
  tirage,
  qrDataUrl,
  messagePerdu,
  boutique,
  rang,
}: {
  tirage: TirageResultat;
  qrDataUrl: string | null;
  messagePerdu: string;
  boutique: { nom: string; adresse: string; whatsapp: string };
  /** « 2 / 3 » quand le joueur a plusieurs cadeaux, pour ne pas les confondre. */
  rang?: { position: number; total: number };
}) {
  const gagne = tirage.statut === "gagne";
  const [copie, setCopie] = useState(false);
  const [restant, setRestant] = useState<string | null>(null);
  // `expire` et `restant` dépendent de l'heure : calculés après le montage
  // (le rendu serveur ne doit jamais dépendre de Date.now()).
  const [expire, setExpire] = useState(false);

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

  useEffect(() => {
    if (gagne) {
      /*
       * PAS de confettis ici. /resultat est un « reçu » : le joueur y revient
       * exprès pour montrer son code en boutique, parfois plusieurs fois. Les
       * confettis couvraient le code et le QR (le canvas est au-dessus des
       * cartes), et avec plusieurs cadeaux empilés la page devenait
       * illisible. L'effet « jackpot » reste sur la popup, au moment du gain.
       */
      jouerVictoire();
      suivreEvenement("joue_victoire", {
        cadeau: tirage.cadeau_nom,
        valeur: 0,
      });
    } else {
      jouerPerte();
    }
  }, [gagne, tirage.cadeau_nom]);

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
    <div className="flex flex-1 flex-col gap-3">
      {/* ---------------------------------------------------------------- */}
      {/* En-tête : gagné / perdu                                           */}
      {/* ---------------------------------------------------------------- */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-center gap-3 text-left"
      >
        <motion.div
          initial={{ scale: 0.5, rotate: -14 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 14, delay: 0.08 }}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-or/40 bg-or/10"
        >
          {gagne ? (
            <PartyPopper className="size-5 text-or" />
          ) : (
            <Ticket className="size-5 text-cendre" />
          )}
        </motion.div>
        <div className="min-w-0">
          <TitreOr as="h1" className="text-[1.45rem] leading-tight sm:text-[1.7rem]">
            {gagne ? "Vous avez gagné !" : "Pas de chance"}
            {rang && rang.total > 1 && (
              <span className="ml-2 align-middle text-[11px] font-semibold tracking-[0.14em] text-or/80 uppercase">
                {rang.position} / {rang.total}
              </span>
            )}
          </TitreOr>
          <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-cendre/85">
            {gagne ? "Montrez ce code en boutique." : messagePerdu}
          </p>
        </div>
      </motion.header>

      {/* ---------------------------------------------------------------- */}
      {/* GAGNÉ                                                             */}
      {/* ---------------------------------------------------------------- */}
      {gagne && (
        <>
          <Carte className="relative overflow-hidden !p-4">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-40 blur-2xl"
              style={{
                background: `radial-gradient(ellipse at top, ${tirage.cadeau_couleur ?? "#e8c66a"}, transparent 70%)`,
              }}
            />
            <div className="relative flex items-center gap-3 text-left">
              {tirage.cadeau_image_url ? (
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-or/30">
                  <Image
                    src={tirage.cadeau_image_url}
                    alt={tirage.cadeau_nom ?? "Cadeau"}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <span className="grid size-16 shrink-0 place-items-center rounded-xl border border-or/25 bg-black/30">
                  {/* Icône vectorielle et non emoji : les emoji ne s'affichent
                      pas sur beaucoup de téléphones (carrés vides). */}
                  <IconeCadeau
                    nom={tirage.cadeau_nom ?? "Cadeau"}
                    taille={30}
                    couleur="rgba(232,198,106,0.95)"
                  />
                </span>
              )}
              <div className="min-w-0">
                <h2 className="font-titre text-[17px] leading-tight font-semibold text-creme">
                  {tirage.cadeau_nom ?? "Cadeau surprise"}
                </h2>
                {tirage.cadeau_description && (
                  <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-cendre/75">
                    {tirage.cadeau_description}
                  </p>
                )}
              </div>
            </div>
          </Carte>

          {/* Code + QR */}
          <Carte className="!p-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <Pastille ton="or" className="mb-2 !px-2.5 !py-0.5 !text-[10px]">
                  <QrIcone className="size-3" /> Code de retrait
                </Pastille>
                <button
                  type="button"
                  onClick={copierCode}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl border border-or/35 bg-black/40 px-2 py-2.5 transition-colors hover:border-or/60"
                  aria-label="Copier mon code"
                >
                  <span className="truncate font-mono text-[17px] font-bold tracking-[0.14em] text-or-clair">
                    {tirage.code_unique}
                  </span>
                  {copie ? (
                    <Check className="size-4 shrink-0 text-emerald-400" />
                  ) : (
                    <Copy className="size-4 shrink-0 text-or/60 group-hover:text-or" />
                  )}
                </button>
                <p className="mt-1 text-center text-[9.5px] tracking-wide text-cendre/50 uppercase">
                  Appuyez pour copier
                </p>
              </div>

              {qrDataUrl && (
                <div className="shrink-0 rounded-xl border border-or/30 bg-or-clair p-1.5 shadow-[0_12px_28px_-16px_rgba(232,198,106,0.8)]">
                  {/* Image data-URL générée par le serveur : <img> volontaire */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt={`QR code du cadeau ${tirage.code_unique}`}
                    width={104}
                    height={104}
                    className="size-[104px] rounded-md"
                  />
                </div>
              )}
            </div>
          </Carte>

          {/* Validité + retrait */}
          <Carte className="!p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-or" />
                <div>
                  <p className="text-[10.5px] tracking-[0.14em] text-cendre/60 uppercase">
                    À retirer avant
                  </p>
                  <p className="text-[12.5px] font-semibold text-creme">
                    {formatDateHeure(tirage.expire_le)}
                  </p>
                  {restant && !expire && (
                    <p className="text-[11px] text-or/80">Il reste {restant}</p>
                  )}
                </div>
              </div>
              {tirage.recupere && (
                <Pastille ton="vert">
                  <Check className="size-3.5" /> Retiré
                </Pastille>
              )}
            </div>

            <div className="filet-or my-2.5" />

            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-or" />
              <div>
                <p className="text-[11px] tracking-[0.14em] text-cendre/60 uppercase">En boutique</p>
                <p className="text-[13px] font-semibold text-creme">{boutique.nom}</p>
                <p className="text-[12px] text-cendre/70">{boutique.adresse}</p>
              </div>
            </div>

            {(expire || tirage.recupere) && (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-bordeaux-clair/40 bg-bordeaux/20 px-3 py-2 text-[12px] leading-relaxed text-rose-100">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                {tirage.recupere
                  ? "Ce cadeau a déjà été retiré en boutique."
                  : "Ce code a expiré. Passez nous voir, nous avons toujours une petite attention."}
              </p>
            )}
          </Carte>
        </>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* PERDU                                                             */}
      {/* ---------------------------------------------------------------- */}
      {!gagne && (
        <Carte className="text-center">
          <Pastille ton="neutre" className="mb-3">
            <Ticket className="size-3.5" /> Votre bon de consolation
          </Pastille>
          <p className="font-titre text-[3rem] leading-none font-bold text-or-clair">
            −{tirage.reduction_consolation ?? 10}%
          </p>
          <p className="mt-1 text-[12.5px] text-cendre">
            sur votre prochain achat en boutique
          </p>
          <div className="filet-or my-4" />
          <p className="text-[12px] leading-relaxed text-cendre/75">
            Montrez simplement cet écran à la caisse. Valable une fois, jusqu&apos;au{" "}
            {formatDateHeure(tirage.expire_le)}.
          </p>
        </Carte>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Partage / parrainage                                              */}
      {/* ---------------------------------------------------------------- */}
      <Partager tourBonus={!gagne} />

      <p className="text-center text-[10px] leading-snug text-cendre/45">
        1 participation par numéro · Tirage serveur
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Bloc de partage : +1 tour pour un ami qui s'inscrit                        */
/* -------------------------------------------------------------------------- */
function Partager({ tourBonus }: { tourBonus: boolean }) {
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
    suivreEvenement("joue_partage", { bonus: tourBonus });
    if (navigator.share && lien) {
      try {
        await navigator.share({
          title: "Roue de la Fortune",
          text: "Tourne la roue et gagne un cadeau en boutique !",
          url: lien,
        });
        return;
      } catch {
        /* l'utilisateur a annulé : on propose WhatsApp */
      }
    }
    if (whatsapp) window.open(whatsapp, "_blank", "noopener,noreferrer");
  }

  return (
    <Carte className="!p-3.5">
      <p className="flex items-center gap-2 text-[11.5px] leading-snug text-cendre/80">
        <span className="grid size-6 shrink-0 place-items-center rounded-full border border-emeraude/40 bg-emeraude/15">
          <Share2 className="size-3 text-emerald-300" />
        </span>
        {tourBonus ? "Encore une chance : " : "Faites gagner un ami : "}
        <strong className="font-semibold text-or-clair">+1 tour offert</strong>
      </p>

      <div className="mt-2 flex gap-1.5">
        <BoutonOr
          type="button"
          onClick={partager}
          disabled={chargement || !lien}
          className="!py-2.5 flex-1 text-[12.5px]"
        >
          <MessageCircle className="size-3.5" />
          {chargement ? "Lien…" : "Partager"}
        </BoutonOr>
        <Link href="/roue" className="btn-fantome shrink-0 !px-3 !py-2.5 text-[12.5px]">
          <Gift className="size-3.5" /> La roue
        </Link>
      </div>
    </Carte>
  );
}
