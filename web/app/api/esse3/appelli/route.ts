import { NextResponse } from "next/server";
import { esse3WebBase } from "@unidesk/core";
import { esse3OrNull } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const client = await esse3OrNull();
  if (!client) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  try {
    const q = new URL(req.url).searchParams;
    const matId = Number(q.get("matId"));
    const cdsId = Number(q.get("cdsId"));
    const adId = Number(q.get("adId"));
    if (!matId || !cdsId || !adId) {
      return NextResponse.json(
        { error: "matId, cdsId e adId sono obbligatori" },
        { status: 400 },
      );
    }
    return NextResponse.json(await client.getAppelliConStato(matId, cdsId, adId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message, esse3Url: `${esse3WebBase()}/auth/studente/Appelli/AppelliF.do` },
      { status: 502 },
    );
  }
}
