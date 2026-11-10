import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Bouton doré principal. */
export function BoutonOr({
  className,
  children,
  ...props
}: ComponentProps<"button">) {
  return (
    <button className={cn("btn-or w-full text-base", className)} {...props}>
      {children}
    </button>
  );
}

/** Lien stylé comme le bouton doré. */
export function LienOr({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn("btn-or w-full text-base", className)}>
      {children}
    </Link>
  );
}

/** Bouton secondaire (contour doré). */
export function BoutonFantome({
  className,
  children,
  ...props
}: ComponentProps<"button">) {
  return (
    <button className={cn("btn-fantome", className)} {...props}>
      {children}
    </button>
  );
}

/** Carte « luxe » avec liseré doré. */
export function Carte({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("carte-luxe p-5 sm:p-6", className)}>{children}</div>;
}

/** Titre principal en dégradé d'or. */
export function TitreOr({
  children,
  className,
  as: Balise = "h1",
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <Balise
      className={cn(
        "texte-or font-titre font-semibold tracking-[0.06em] uppercase",
        className,
      )}
    >
      {children}
    </Balise>
  );
}

/** Petite pastille d'information. */
export function Pastille({
  children,
  ton = "or",
  className,
}: {
  children: ReactNode;
  ton?: "or" | "vert" | "rouge" | "neutre";
  className?: string;
}) {
  const tons = {
    or: "border-or/40 bg-or/10 text-or-clair",
    vert: "border-emeraude/50 bg-emeraude/15 text-emerald-200",
    rouge: "border-bordeaux-clair/50 bg-bordeaux/25 text-rose-200",
    neutre: "border-white/10 bg-white/5 text-cendre",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
        tons[ton],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Séparateur décoratif doré. */
export function Filet({ className }: { className?: string }) {
  return <div className={cn("filet-or my-5 w-full", className)} />;
}
