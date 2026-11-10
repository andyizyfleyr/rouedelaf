import "server-only";

/**
 * Validation des variables d'environnement côté serveur.
 * Échoue tôt et clairement plutôt qu'au milieu d'un tirage.
 */

function requis(cle: string): string {
  const valeur = process.env[cle];
  if (!valeur) {
    throw new Error(
      `Variable d'environnement manquante : ${cle}. Voir .env.example pour la liste complète.`,
    );
  }
  return valeur;
}

function optionnel(cle: string, defaut = ""): string {
  return process.env[cle] ?? defaut;
}

/** Accès centralisé aux secrets serveur (jamais importé par un client). */
export const env = {
  get databaseUrl() {
    return requis("DATABASE_URL");
  },
  get sessionSecret() {
    return requis("ADMIN_SESSION_SECRET");
  },
  get adminPassword() {
    return requis("ADMIN_PASSWORD");
  },
  get otpPepper() {
    return optionnel("OTP_PEPPER", "sel-de-developpement-non-securise");
  },
  get upstash() {
    const url = optionnel("UPSTASH_REDIS_REST_URL");
    const token = optionnel("UPSTASH_REDIS_REST_TOKEN");
    return url && token ? { url, token } : null;
  },
  get appUrl() {
    return optionnel("NEXT_PUBLIC_APP_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  get borneToken() {
    return optionnel("BORNE_TOKEN");
  },
  get devOtpCode() {
    return process.env.NODE_ENV === "production" ? "" : optionnel("DEV_OTP_CODE");
  },
  get whatsappDriver(): "console" | "meta" | "twilio" {
    const driver = optionnel("WHATSAPP_DRIVER", "console");
    if (driver === "meta") return "meta";
    if (driver === "twilio") return "twilio";
    return "console";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};

/** Infos boutique exposées au navigateur (préfixe NEXT_PUBLIC_ obligatoire). */
export const boutique = {
  nom: optionnel("NEXT_PUBLIC_BOUTIQUE_NOM", "Ma Boutique"),
  adresse: optionnel("NEXT_PUBLIC_BOUTIQUE_ADRESSE", "Cotonou, Bénin"),
  whatsapp: optionnel("NEXT_PUBLIC_BOUTIQUE_WHATSAPP", "+22900000000"),
  appUrl: optionnel("NEXT_PUBLIC_APP_URL", "http://localhost:3000").replace(/\/$/, ""),
  metaPixelId: optionnel("NEXT_PUBLIC_META_PIXEL_ID"),
  tiktokPixelId: optionnel("NEXT_PUBLIC_TIKTOK_PIXEL_ID"),
};
