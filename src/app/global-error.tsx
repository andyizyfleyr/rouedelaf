"use client";

/**
 * Filet de sécurité global.
 *
 * Une exception non rattrapée affichait jusqu'ici l'écran brut de Next.js
 * (« Application error: a server-side exception has occurred »). Sur cette
 * app, l'écran est vu par des clients en boutique : on affiche un message en
 * français qui explique quoi faire, et un bouton pour réessayer.
 */
export default function ErreurGlobale({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#0a0908",
          color: "#f5efe0",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "34rem" }}>
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "#e8c66a",
              margin: 0,
            }}
          >
            La roue de la fortune
          </p>
          <h1 style={{ fontSize: "1.6rem", margin: "12px 0" }}>
            Un instant, on remet la roue en place
          </h1>
          <p style={{ fontSize: "0.95rem", lineHeight: 1.6, color: "#b9b2a3" }}>
            Une erreur inattendue s&apos;est produite. Votre participation n&apos;est pas
            perdue : appuyez sur le bouton ci-dessous. Si le problème persiste,
            présentez-vous en boutique avec votre numéro WhatsApp.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "20px",
              padding: "14px 28px",
              borderRadius: "999px",
              border: "1px solid rgba(232,198,106,0.55)",
              background: "linear-gradient(135deg, #e8c66a, #a8842f)",
              color: "#1a1410",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
          {error.digest ? (
            <p style={{ marginTop: "16px", fontSize: "11px", color: "#6f695e" }}>
              Référence technique : {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
