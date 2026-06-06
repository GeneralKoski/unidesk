import { NextResponse } from "next/server";
import { ellyOrNull } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const client = await ellyOrNull();
  if (!client) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  try {
    const param = new URL(req.url).searchParams.get("courseid");
    if (!param) {
      return NextResponse.json({ error: "courseid mancante" }, { status: 400 });
    }
    return NextResponse.json(await client.getCourseContents(Number(param)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
