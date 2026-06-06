import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import {
  Esse3Client,
  ellyClient,
  esse3Base,
  ellyBase,
  loadEnv,
} from "@unidesk/core";

// Le credenziali Unipr (uguali per Esse3 ed Elly) vivono CIFRATE nel cookie di
// sessione (iron-session): httpOnly, leggibili solo dal server.
export interface SessionData {
  user?: string;
  pass?: string;
}

function options(): SessionOptions {
  loadEnv();
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET mancante o < 32 caratteri (vedi .env).");
  }
  return {
    password,
    cookieName: "unidesk_session",
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 giorni
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), options());
}

export async function getCreds(): Promise<{ user: string; pass: string } | null> {
  const s = await getSession();
  return s.user && s.pass ? { user: s.user, pass: s.pass } : null;
}

// Client già autenticati con le credenziali della sessione, o null se assente.
export async function esse3OrNull(): Promise<Esse3Client | null> {
  const c = await getCreds();
  return c ? new Esse3Client({ base: esse3Base(), ...c }) : null;
}

export async function ellyOrNull() {
  const c = await getCreds();
  return c ? ellyClient({ base: ellyBase(), ...c }) : null;
}
