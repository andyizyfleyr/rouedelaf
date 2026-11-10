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

import { BoutonOr, Carte, Pastille, TitreOr } from "@/components/ui/Base";
import { formatDateHeure, tempsRestant } from "@/lib/format";
import { lancerConfettis } from "@/lib/confettis";
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
}: {
  tirage: TirageResultat;
  qrDataUrl: string | null;
  messagePerdu: string;
  boutique: { nom: string; adresse: string; whatsapp: string };
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
      lancerConfettis({ intense: true });
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
    <div className="flex flex-1 flex-col gap-5">
      {/* ---------------------------------------------------------------- */}
      {/* En-tête : gagné / perdu                                           */}
      {/* ---------------------------------------------------------------- */}
      <motion.header
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0.6, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
          className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full border border-or/40 bg-or/10"
        >
          {gagne ? (
            <PartyPopper className="size-8 text-or" />
          ) : (
            <Ticket className="size-8 text-cendre" />
          )}
        </motion.div>

        <TitreOr as="h1" className="text-[1.9rem] leading-tight sm:text-[2.2rem]">
          {gagne ? "Vous avez gagné !" : "Pas de chance"}
        </TitreOr>
        <p className="mx-auto mt-2 max-w-[36ch] text-[13.5px] leading-relaxed text-cendre">
          {gagne
            ? "Présentez ce code en boutique avant la date limite pour retirer votre cadeau."
            : messagePerdu}
        </p>
      </motion.header>

      {/* ---------------------------------------------------------------- */}
      {/* GAGNÉ                                                             */}
      {/* ---------------------------------------------------------------- */}
      {gagne && (
        <>
          <Carte className="relative overflow-hidden text-center">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-40 blur-2xl"
              style={{
                background: `radial-gradient(ellipse at top, ${tirage.cadeau_couleur ?? "#e8c66a"}, transparent 70%)`,
              }}
            />
            <div className="relative">
              <span className="text-4xl">{tirage.cadeau_icone ?? "🎁"}</span>
              <h2 className="mt-2 font-titre text-xl font-semibold text-creme">
                {tirage.cadeau_nom ?? "Cadeau surprise"}
              </h2>
              {tirage.cadeau_description && (
                <p className="mx-auto mt-1.5 max-w-[34ch] text-[12.5px] leading-relaxed text-cendre/80">
                  {tirage.cadeau_description}
                </p>
              )}
              {tirage.cadeau_image_url && (
                <div className="relative mx-auto mt-3 aspect-square w-36 overflow-hidden rounded-xl border border-or/25">
                  <Image
                    src={tirage.cadeau_image_url}
                    alt={tirage.cadeau_nom ?? "Cadeau"}
                    fill
                    sizes="144px"
                    className="object-cover"
                  />
                </div>
              )}
            </div>
          </Carte>

          {/* Code + QR */}
          <Carte className="text-center">
            <Pastille ton="or" className="mb-3">
              <QrIcone className="size-3.5" /> Code de retrait
            </Pastille>

            <button
              type="button"
              onClick={copierCode}
              className="group mx-auto flex items-center justify-center gap-2 rounded-xl border border-or/35 bg-black/40 px-4 py-3 transition-colors hover:border-or/60"
              aria-label="Copier mon code"
            >
              <span className="font-mono text-xl font-bold tracking-[0.18em] text-or-clair">
                {tirage.code_unique}
              </span>
              {copie ? (
                <Check className="size-4 text-emerald-400" />
              ) : (
                <Copy className="size-4 text-or/60 group-hover:text-or" />
              )}
            </button>
            <p className="mt-1.5 text-[10.5px] tracking-wide text-cendre/55 uppercase">
              Appuyez pour copier
            </p>

            {qrDataUrl && (
              <div className="mt-4 flex flex-col items-center">
                <div className="rounded-2xl border border-or/30 bg-or-clair p-2.5 shadow-[0_18px_40px_-20px_rgba(232,198,106,0.7)]">
                  {/* Image data-URL générée par le serveur : <img> volontaire */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt={`QR code du cadeau ${tirage.code_unique}`}
                    width={168}
                    height={168}
                    className="size-[168px] rounded-lg"
                  />
                </div>
                <p className="mt-2 max-w-[30ch] text-[11px] leading-relaxed text-cendre/60">
                  La vendeuse scanne ce QR code pour valider la remise en boutique.
                </p>
              </div>
            )}
          </Carte>

          {/* Validité + retrait */}
          <Carte className="!p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-or" />
                <div>
                  <p className="text-[11px] tracking-[0.14em] text-cendre/60 uppercase">
                    À retirer avant
                  </p>
                  <p className="text-[13px] font-semibold text-creme">
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

            <div className="filet-or my-3" />

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
          <p className="font-titre text-[3.2rem] leading-none font-bold text-or-clair">
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

      <p className="text-center text-[11px] leading-relaxed text-cendre/50">
        Une seule participation par numéro WhatsApp. Tirage effectué sur le serveur de la
        boutique.
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
    <Carte className="!p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-emeraude/40 bg-emeraude/15">
          <Share2 className="size-4 text-emerald-300" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-creme">
            {tourBonus ? "Encore une chance ?" : "Faites gagner un ami"}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-cendre/75">
            Partagez votre lien : dès qu&apos;un ami s&apos;inscrit, vous gagnez{" "}
            <strong className="text-or-clair">1 tour offert</strong>.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <BoutonOr
          type="button"
          onClick={partager}
          disabled={chargement || !lien}
          className="!py-3 text-sm"
        >
          <MessageCircle className="size-4" />
          {chargement ? "Préparation du lien…" : "Partager sur WhatsApp"}
        </BoutonOr>
        <Link href="/roue" className="btn-fantome text-[12.5px]">
          <Gift className="size-3.5" /> Retourner à la roue
        </Link>
      </div>

      {lien && (
        <p className="mt-2 truncate text-center text-[10px] text-cendre/45">{lien}</p>
      )}
    </Carte>
  );
}
