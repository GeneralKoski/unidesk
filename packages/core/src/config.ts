import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

function findEnvFile(start: string): string | undefined {
  let dir = start;
  while (true) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

let loaded = false;

// Carica il primo `.env` trovato risalendo da cwd. Idempotente: chiamarla più
// volte non ricarica (così Next.js e tsx condividono lo stesso file alla root).
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const file = findEnvFile(process.cwd());
  if (file) {
    try {
      process.loadEnvFile(file);
    } catch {
      // file illeggibile: si prosegue con le sole variabili già nell'ambiente
    }
  }
}

function required(name: string): string {
  loadEnv();
  const value = process.env[name];
  if (!value) throw new Error(`Variabile d'ambiente mancante: ${name}`);
  return value;
}

export interface Esse3Config {
  base: string;
  user: string;
  pass: string;
}
export interface EllyConfig {
  base: string;
  user: string;
  pass: string;
}

export function esse3Config(): Esse3Config {
  loadEnv();
  return {
    base:
      process.env.ESSE3_BASE ?? "https://unipr.esse3.cineca.it/e3rest/api",
    user: required("ESSE3_USER"),
    pass: required("ESSE3_PASS"),
  };
}

export function ellyConfig(): EllyConfig {
  loadEnv();
  return {
    base: required("ELLY_BASE").replace(/\/+$/, ""),
    user: required("ELLY_USER"),
    pass: required("ELLY_PASS"),
  };
}

// Base del sito web Esse3 (non REST), per deep-link verso pagine come gli
// appelli / la compilazione del questionario. Derivata dalla base REST.
export function esse3WebBase(): string {
  loadEnv();
  const base =
    process.env.ESSE3_BASE ?? "https://unipr.esse3.cineca.it/e3rest/api";
  return base.replace(/\/e3rest\/api\/?$/, "");
}

// Stato delle credenziali senza esporne i valori: serve alla UI per mostrare
// se l'app è pronta a chiamare le API o se manca ancora qualcosa nel `.env`.
export interface CredentialStatus {
  esse3: { configured: boolean; user: string | null; base: string };
  elly: { configured: boolean; user: string | null; base: string | null };
}

export function credentialStatus(): CredentialStatus {
  loadEnv();
  return {
    esse3: {
      configured: Boolean(process.env.ESSE3_USER && process.env.ESSE3_PASS),
      user: process.env.ESSE3_USER ?? null,
      base: process.env.ESSE3_BASE ?? "https://unipr.esse3.cineca.it/e3rest/api",
    },
    elly: {
      configured: Boolean(process.env.ELLY_USER && process.env.ELLY_PASS),
      user: process.env.ELLY_USER ?? null,
      base: process.env.ELLY_BASE ?? null,
    },
  };
}
