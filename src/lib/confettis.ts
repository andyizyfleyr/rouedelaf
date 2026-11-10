"use client";

/**
 * Confettis dorés (canvas-confetti chargé à la demande : 8 Ko, uniquement
 * quand on gagne — jamais sur l'écran de perte).
 */
export async function lancerConfettis(opts: { intense?: boolean } = {}): Promise<void> {
  if (typeof window === "undefined") return;

  // Respect de la préférence « animations réduites ».
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  try {
    const charge = await import("canvas-confetti");
    // Canvas dédié, empilé SOUS la popup de résultat : les confettis
    // décoraient l'écran mais passaient par-dessus le code et le QR, qui
    // devenaient illisibles. Le canvas est créé une seule fois.
    const confetti = charge.default.create(canvasConfettis(), { resize: true, useWorker: true });
    const couleurs = ["#e8c66a", "#f8e7a8", "#fff3c4", "#a9822b", "#ffffff", "#7c1d2e"];
    const duree = opts.intense ? 3200 : 1800;
    const fin = Date.now() + duree;

    // Rafale latérale + pluie verticale : effet « jackpot ».
    const tirer = () => {
      confetti({
        particleCount: opts.intense ? 55 : 32,
        startVelocity: 42,
        spread: 70,
        ticks: 240,
        gravity: 0.9,
        scalar: 1.05,
        colors: couleurs,
        origin: { x: 0.5, y: 0.62 },
        disableForReducedMotion: true,
      });
      if (Date.now() < fin) requestAnimationFrame(tirer);
    };
    tirer();

    if (opts.intense) {
      setTimeout(() => {
        confetti({
          particleCount: 90,
          angle: 60,
          spread: 65,
          origin: { x: 0, y: 0.7 },
          colors: couleurs,
          disableForReducedMotion: true,
        });
        confetti({
          particleCount: 90,
          angle: 120,
          spread: 65,
          origin: { x: 1, y: 0.7 },
          colors: couleurs,
          disableForReducedMotion: true,
        });
      }, 260);
    }
  } catch (e) {
    console.warn("[confettis] indisponible", e);
  }
}

/**
 * Canvas plein écran, mais avec un z-index volontairement BAS (1) : il reste
 * sous la popup (z-50) et sous les cartes. `pointer-events: none` pour ne
 * jamais intercepter un appui.
 */
function canvasConfettis(): HTMLCanvasElement {
  const existant = document.getElementById("canvas-confettis") as HTMLCanvasElement | null;
  if (existant) return existant;
  const canvas = document.createElement("canvas");
  canvas.id = "canvas-confettis";
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "1",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(canvas);
  return canvas;
}
