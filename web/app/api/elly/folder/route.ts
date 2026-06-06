import { NextResponse } from "next/server";
import { ellyOrNull } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const client = await ellyOrNull();
  if (!client) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  try {
    const url = new URL(req.url).searchParams.get("url");
    if (!url) return NextResponse.json({ error: "url mancante" }, { status: 400 });
    return NextResponse.json(await client.getFolderFiles(url));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
