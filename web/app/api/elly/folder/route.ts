import { NextResponse } from "next/server";
import { ellyForBaseOrNull } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const client = await ellyForBaseOrNull(params.get("base"));
  if (!client) return NextResponse.json({ error: "Non autenticato o istanza Elly sconosciuta" }, { status: 401 });
  try {
    const url = params.get("url");
    if (!url) return NextResponse.json({ error: "url mancante" }, { status: 400 });
    return NextResponse.json(await client.getFolderFiles(url));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
