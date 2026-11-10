import "server-only";

import { env } from "./env";

/**
 * Envoi des codes OTP par WhatsApp.
 *
 * Trois drivers :
 *  - "console" : le code est affiché dans les logs du serveur (développement).
 *  - "meta"    : WhatsApp Cloud API (recommandé au Bénin, gratuit jusqu'à 1000
 *                conversations de service / mois).
 *  - "twilio"  : alternative si vous avez déjà un compte Twilio.
 *
 * Le driver est choisi par la variable WHATSAPP_DRIVER.
 */

export type ResultatEnvoi =
  | { ok: true; driver: string }
  | { ok: false; driver: string; erreur: string };

export async function envoyerCodeWhatsApp(telephone: string, code: string): Promise<ResultatEnvoi> {
  const driver = env.whatsappDriver;

  if (driver === "meta") {
    return envoyerViaMeta(telephone, code);
  }
  if (driver === "twilio") {
    return envoyerViaTwilio(telephone, code);
  }

  // Driver console : adapté au développement et aux démonstrations.
  console.info(
    `\n📱 [WhatsApp:console] Code OTP pour +${telephone} → ${code}\n` +
      `   (configurez WHATSAPP_DRIVER=meta pour un envoi réel)\n`,
  );
  return { ok: true, driver: "console" };
}

/** WhatsApp Cloud API — https://developers.facebook.com/docs/whatsapp/cloud-api */
async function envoyerViaMeta(telephone: string, code: string): Promise<ResultatEnvoi> {
  const token = process.env.WHATSAPP_META_TOKEN;
  const phoneId = process.env.WHATSAPP_META_PHONE_ID;
  const template = process.env.WHATSAPP_META_TEMPLATE;

  if (!token || !phoneId) {
    return { ok: false, driver: "meta", erreur: "WHATSAPP_META_TOKEN / PHONE_ID manquants" };
  }

  const corps = template
    ? {
        messaging_product: "whatsapp",
        to: telephone,
        type: "template",
        template: {
          name: template,
          language: { code: "fr" },
          components: [
            { type: "body", parameters: [{ type: "text", text: code }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
          ],
        },
      }
    : {
        messaging_product: "whatsapp",
        to: telephone,
        type: "text",
        text: { preview_url: false, body: `Votre code de vérification : ${code}` },
      };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(corps),
      // Un envoi WhatsApp ne doit pas bloquer la requête du client.
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      const texte = await res.text().catch(() => "");
      console.error("[whatsapp:meta] échec", res.status, texte.slice(0, 400));
      return { ok: false, driver: "meta", erreur: `Meta ${res.status}` };
    }
    return { ok: true, driver: "meta" };
  } catch (e) {
    console.error("[whatsapp:meta] exception", e);
    return { ok: false, driver: "meta", erreur: "Réseau indisponible" };
  }
}

/** Twilio WhatsApp — https://www.twilio.com/docs/whatsapp */
async function envoyerViaTwilio(telephone: string, code: string): Promise<ResultatEnvoi> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";

  if (!sid || !token) {
    return { ok: false, driver: "twilio", erreur: "TWILIO_ACCOUNT_SID / AUTH_TOKEN manquants" };
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: from,
        To: `whatsapp:+${telephone}`,
        Body: `Votre code de vérification : ${code}`,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      console.error("[whatsapp:twilio] échec", res.status, (await res.text()).slice(0, 400));
      return { ok: false, driver: "twilio", erreur: `Twilio ${res.status}` };
    }
    return { ok: true, driver: "twilio" };
  } catch (e) {
    console.error("[whatsapp:twilio] exception", e);
    return { ok: false, driver: "twilio", erreur: "Réseau indisponible" };
  }
}
