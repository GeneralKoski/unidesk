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
// volte non ricarica (così Next.js condivide lo stesso file alla root).
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

// Base URL (non segrete). Le credenziali utente arrivano dalla sessione di
// login, non dall'ambiente.
export function esse3Base(): string {
  loadEnv();
  return process.env.ESSE3_BASE ?? "https://unipr.esse3.cineca.it/e3rest/api";
}

export function ellyBase(): string {
  loadEnv();
  return (
    process.env.ELLY_BASE ?? "https://elly2025.didattica.unipr.it"
  ).replace(/\/+$/, "");
}

// Base del sito web Esse3 (non REST), per deep-link verso pagine come gli
// appelli / la compilazione del questionario. Derivata dalla base REST.
export function esse3WebBase(): string {
  return esse3Base().replace(/\/e3rest\/api\/?$/, "");
}
