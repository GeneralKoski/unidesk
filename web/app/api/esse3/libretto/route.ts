import { NextResponse } from "next/server";
import { esse3OrNull } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const client = await esse3OrNull();
  if (!client) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  try {
    const param = new URL(req.url).searchParams.get("matId");
    const matId = param ? Number(param) : (await client.getActiveCareer()).matId;
    return NextResponse.json(await client.getLibretto(matId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
