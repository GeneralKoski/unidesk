import { NextResponse } from "next/server";
import { ellyClientsOrNull } from "@/lib/session";
import type { Course } from "@unidesk/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Elenca i corsi di TUTTE le istanze Elly configurate (anno corrente e
// precedenti). Le iscrizioni non migrano fra un anno accademico e l'altro,
// quindi chi ha esami arretrati ha i corsi sparsi su piu' istanze.
export async function GET(req: Request) {
  const clients = await ellyClientsOrNull();
  if (!clients) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  // In parallelo: ogni istanza richiede un login Shibboleth suo, e in serie
  // l'attesa si sommerebbe.
  const settled = await Promise.allSettled(clients.map((c) => c.getCourses()));

  const courses: Course[] = [];
  const failed: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") courses.push(...r.value);
    else failed.push(new URL(clients[i].base).host);
  });

  // Un'istanza vecchia puo' essere lenta o archiviata: se almeno una risponde
  // si mostra quello che c'e', segnalando quali hanno fallito. Fallire tutto
  // perche' l'anno scorso non risponde renderebbe l'app inutilizzabile.
  if (courses.length === 0 && failed.length > 0) {
    return NextResponse.json(
      { error: `Nessuna istanza Elly raggiungibile (${failed.join(", ")})` },
      { status: 502 },
    );
  }

  // Prima l'anno piu' recente, poi per nome.
  courses.sort(
    (a, b) => (b.year ?? 0) - (a.year ?? 0) || a.fullname.localeCompare(b.fullname),
  );

  // La forma predefinita resta l'array, perche' e' quella che i client gia'
  // pubblicati (l'app mobile) si aspettano: cambiarla li romperebbe senza che
  // possano aggiornarsi subito. Chi vuole sapere anche quali istanze non hanno
  // risposto lo chiede esplicitamente con ?withStatus=1.
  const withStatus = new URL(req.url).searchParams.get("withStatus") === "1";
  return NextResponse.json(withStatus ? { courses, failed } : courses);
}
