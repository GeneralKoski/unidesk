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

// Unipr tiene un'istanza Moodle separata per ogni anno accademico
// (elly2025, elly2026, ...). Le iscrizioni NON migrano: i corsi del primo anno
// restano sull'istanza di quell'anno. Chi ha esami arretrati deve quindi
// leggere piu' istanze insieme, altrimenti quei corsi spariscono dall'elenco.

// L'anno accademico che inizia a settembre: da settembre in poi e' l'anno
// corrente, prima e' quello precedente.
export function currentAcademicYear(now: Date = new Date()): number {
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

function defaultEllyBases(): string[] {
  const y = currentAcademicYear();
  return [y, y - 1].map((n) => `https://elly${n}.didattica.unipr.it`);
}

// Tutte le istanze Elly da interrogare, in ordine: la prima e' quella corrente.
// ELLY_BASES (separate da virgola) le fissa esplicitamente; ELLY_BASE, che
// resta per compatibilita', ne fissa una sola. Senza nessuna delle due si
// usano l'anno corrente e il precedente, calcolati dalla data.
export function ellyBases(): string[] {
  loadEnv();
  const raw = process.env.ELLY_BASES ?? process.env.ELLY_BASE;
  const list = raw
    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : defaultEllyBases();
  const seen = new Set<string>();
  return list
    .map((s) => s.replace(/\/+$/, ""))
    .filter((s) => (seen.has(s) ? false : (seen.add(s), true)));
}

// L'istanza corrente. Resta per i chiamanti che ne vogliono una sola.
export function ellyBase(): string {
  return ellyBases()[0];
}

// Vero se la base e' fra quelle configurate. Da usare SEMPRE prima di
// costruire un client con una base che arriva dalla richiesta: senza, un
// parametro arbitrario farebbe partire richieste autenticate verso host
// qualunque.
export function isKnownEllyBase(base: string): boolean {
  const norm = base.replace(/\/+$/, "");
  return ellyBases().includes(norm);
}

// Base del sito web Esse3 (non REST), per deep-link verso pagine come gli
// appelli / la compilazione del questionario. Derivata dalla base REST.
export function esse3WebBase(): string {
  return esse3Base().replace(/\/e3rest\/api\/?$/, "");
}
