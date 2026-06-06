import { NextResponse } from "next/server";
import { esse3WebBase } from "@unidesk/core";
import { esse3OrNull } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const client = await esse3OrNull();
  if (!client) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  try {
    const { cdsId, adId, appId, adsceId } = await req.json();
    if (!cdsId || !adId || !appId || !adsceId) {
      return NextResponse.json(
        { error: "cdsId, adId, appId e adsceId sono obbligatori" },
        { status: 400 },
      );
    }
    const result = await client.prenota(cdsId, adId, appId, adsceId);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
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
