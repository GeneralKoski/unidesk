import { NextResponse } from "next/server";
import { esse3OrNull } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const client = await esse3OrNull();
  if (!client) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  try {
    const { cdsId, adId, appId, stuId } = await req.json();
    if (!cdsId || !adId || !appId || !stuId) {
      return NextResponse.json(
        { error: "cdsId, adId, appId e stuId sono obbligatori" },
        { status: 400 },
      );
    }
    const result = await client.disiscrivi(cdsId, adId, appId, stuId);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
