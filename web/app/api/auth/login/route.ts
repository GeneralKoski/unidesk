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
  // Valida le credenziali contro Esse3 prima di salvarle in sessione.
  try {
    await new Esse3Client({ base: esse3Base(), user, pass }).login();
  } catch {
    return NextResponse.json(
      { error: "Credenziali non valide (login Esse3 fallito)." },
      { status: 401 },
    );
  }
  const session = await getSession();
  session.user = user;
  session.pass = pass;
  await session.save();
  return NextResponse.json({ ok: true, user });
}
