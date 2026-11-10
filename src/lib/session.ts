import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { env } from "./env";

/**
 * Sessions signées (JWT courte durée) stockées dans un cookie httpOnly.
 *
 * Deux sessions distinctes :
 *  - « roue_session »  : session de JEU du client (participant inscrit)
 *  - « roue_admin »    : session de l'ADMIN (mot de passe partagé boutique)
 *
 * Le JWT est signé avec ADMIN_SESSION_SECRET : impossible à forger côté client.
 * En base, `sessions_jeu.token_hash` permet de révoquer une session.
 */

const COOKIE_JEU = "roue_session";
const COOKIE_ADMIN = "roue_admin";

const secret = () => new TextEncoder().encode(env.sessionSecret);

export type PayloadJeu = {
  participantId: number;
  nom: string;
  telephone: string;
  /** Identifiant de session en base (révocation possible). */
  sid: string;
};

export type PayloadAdmin = {
  role: "admin";
  /** Identifiant de la vendeuse (facultatif). */
  nom?: string;
};

/* -------------------------------------------------------------------------- */
/*  Session de jeu                                                             */
/* -------------------------------------------------------------------------- */

export async function creerSessionJeu(payload: PayloadJeu): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("4h")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE_JEU, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: 60 * 60 * 4,
  });
}

export async function lireSessionJeu(): Promise<PayloadJeu | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_JEU)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return {
      participantId: Number(payload.participantId),
      nom: String(payload.nom ?? ""),
      telephone: String(payload.telephone ?? ""),
      sid: String(payload.sid ?? ""),
    };
  } catch {
    return null;
  }
}

export async function supprimerSessionJeu(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_JEU);
}

/** Hash du token de session stocké en base (révocation). */
export function hacherToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function nouveauTokenSession(): string {
  return randomBytes(32).toString("base64url");
}

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
