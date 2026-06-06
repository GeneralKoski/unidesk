import { NextResponse } from "next/server";
import { Esse3Client } from "@unidesk/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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
    return NextResponse.json(
      await new Esse3Client().getAppelliConStato(matId, cdsId, adId),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
