import { Suspense } from "react";

/** Chargement générique du parcours client (coquille dorée). */
export default function ChargementClient() {
  return (
    <Suspense>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
        <span
          aria-hidden
          className="size-14 animate-spin rounded-full border-2 border-or/25 border-t-or"
        />
        <p className="text-[11px] tracking-[0.24em] text-cendre/60 uppercase">Chargement…</p>
      </div>
    </Suspense>
  );
}
