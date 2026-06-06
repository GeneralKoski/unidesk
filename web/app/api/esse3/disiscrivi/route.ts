import { NextResponse } from "next/server";
import { Esse3Client } from "@unidesk/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { cdsId, adId, appId, stuId } = await req.json();
    if (!cdsId || !adId || !appId || !stuId) {
      return NextResponse.json(
        { error: "cdsId, adId, appId e stuId sono obbligatori" },
        { status: 400 },
      );
    }
    const result = await new Esse3Client().disiscrivi(cdsId, adId, appId, stuId);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
