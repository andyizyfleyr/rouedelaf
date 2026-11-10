"use client";

import {
  Coffee,
  CreditCard,
  Droplets,
  FlaskConical,
  Gift,
  Package,
  PenLine,
  ShoppingBag,
  Shirt,
  Sparkles,
  Ticket,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Icône d'une case de la roue, déduite du NOM du lot.
 *
 * Pourquoi pas les emoji fournis par l'admin (`cadeaux.icone`) ?
 *  - ils ne s'affichent pas sur beaucoup de téléphones (surtout les modèles
 *    d'entrée de gamme courants au Bénin) : on voyait des carrés vides ;
 *  - ils changent d'apparence d'un appareil à l'autre.
 * Les icônes ci-dessous sont vectorielles, donc identiques partout.
 * L'emoji reste utilisé sur les écrans admin, où il sert de repère.
 */
const REGLES: { motif: RegExp; icone: LucideIcon }[] = [
  { motif: /perdu|rien|dommage/i, icone: Sparkles },
  { motif: /achat|bon|ch[eè]que|credit|crédit|carte/i, icone: CreditCard },
  { motif: /casquette|chapeau|t-shirt|textile|v[eê]tement/i, icone: Shirt },
  { motif: /sac|courses|panier/i, icone: ShoppingBag },
  { motif: /cr[eè]me|hydrat|soin|beaut/i, icone: Droplets },
  { motif: /parfum|[eé]chantillon|flacon/i, icone: FlaskConical },
  { motif: /stylo|bic|crayon/i, icone: PenLine },
  { motif: /caf[eé]|boisson|th[eé]/i, icone: Coffee },
  { motif: /r[eé]duction|remise|promo/i, icone: Ticket },
  { motif: /ticket|bon de|voucher/i, icone: Ticket },
  { motif: /colis|pack|bo[iî]te/i, icone: Package },
];

export function IconeCadeau({
  nom,
  taille = 15,
  couleur = "rgba(255,250,240,0.92)",
  className,
}: {
  nom: string;
  taille?: number;
  couleur?: string;
  className?: string;
}) {
  const regle = REGLES.find((r) => r.motif.test(nom));
  const Icone = regle?.icone ?? Gift;
  return <Icone size={taille} className={className} strokeWidth={2.1} color={couleur} />;
}
