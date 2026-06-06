import { NextResponse } from "next/server";
import { Esse3Client, esse3Base } from "@unidesk/core";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { user, pass } = await req.json();
  if (!user || !pass) {
    return NextResponse.json(
      { error: "Inserisci email e password Unipr." },
      { status: 400 },
    );
  }
  // Valida le credenziali contro Esse3 e recupera la matricola della carriera.
  let matricola: string | undefined;
  try {
    const carriere = await new Esse3Client({ base: esse3Base(), user, pass }).getCarriere();
    const attiva = carriere.find((t) => t.staStuCod === "A") ?? carriere[0];
    matricola = attiva?.matricola;
  } catch {
    return NextResponse.json(
      { error: "Credenziali non valide." },
      { status: 401 },
    );
  }
  const session = await getSession();
  session.user = user;
  session.pass = pass;
  session.matricola = matricola;
  await session.save();
  return NextResponse.json({ ok: true, user, matricola: matricola ?? null });
}
