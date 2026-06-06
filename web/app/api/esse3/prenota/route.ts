import { NextResponse } from "next/server";
import { Esse3Client, esse3WebBase } from "@unidesk/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { cdsId, adId, appId, adsceId } = await req.json();
    if (!cdsId || !adId || !appId || !adsceId) {
      return NextResponse.json(
        { error: "cdsId, adId, appId e adsceId sono obbligatori" },
        { status: 400 },
      );
    }
    const result = await new Esse3Client().prenota(cdsId, adId, appId, adsceId);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Blocco tipico: questionario di valutazione della didattica non compilato.
    if (/questionario/i.test(message)) {
      return NextResponse.json(
        {
          error: message,
          questionarioUrl: `${esse3WebBase()}/auth/studente/Appelli/AppelliF.do`,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
