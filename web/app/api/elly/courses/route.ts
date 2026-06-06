import { NextResponse } from "next/server";
import { ellyOrNull } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const client = await ellyOrNull();
  if (!client) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  try {
    return NextResponse.json(await client.getCourses());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
