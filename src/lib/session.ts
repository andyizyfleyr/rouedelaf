import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { env } from "./env";

/**
 * Session signée (JWT courte durée) stockée dans un cookie httpOnly.
 *
 * Il n'en reste qu'UNE : « roue_admin », la session de l'ADMIN (mot de passe
 * partagé boutique). La session de jeu a disparu avec l'inscription — les
 * clients jouent sur le poste de la boutique, sans compte, donc sans cookie.
 *
 * Le JWT est signé avec ADMIN_SESSION_SECRET : impossible à forger côté client.
 */

const COOKIE_ADMIN = "roue_admin";

const secret = () => new TextEncoder().encode(env.sessionSecret);

export type PayloadAdmin = {
  role: "admin";
  /** Identifiant de la vendeuse (facultatif). */
  nom?: string;
};

/* -------------------------------------------------------------------------- */
/*  Session admin                                                              */
/* -------------------------------------------------------------------------- */

export async function creerSessionAdmin(nom?: string): Promise<void> {
  const token = await new SignJWT({ role: "admin", nom } satisfies PayloadAdmin)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE_ADMIN, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function lireSessionAdmin(): Promise<PayloadAdmin | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_ADMIN)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.role !== "admin") return null;
    return { role: "admin", nom: payload.nom ? String(payload.nom) : undefined };
  } catch {
    return null;
  }
}

export async function supprimerSessionAdmin(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_ADMIN);
}

/** Exige une session admin ; lève une erreur 401 sinon. */
export async function exigerAdmin(): Promise<PayloadAdmin> {
  const admin = await lireSessionAdmin();
  if (!admin) {
    throw new ErreurAuth("Accès réservé à l'administration");
  }
  return admin;
}

export class ErreurAuth extends Error {
  readonly statut = 401;
  constructor(message = "Non authentifié") {
    super(message);
    this.name = "ErreurAuth";
  }
}
