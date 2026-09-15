import { NextResponse } from "next/server";
import { ellyForBaseOrNull } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  // "base" dice su quale istanza Elly vive il corso: gli id sono per-istanza.
  // Senza, si ricade su quella corrente e i corsi degli anni passati non si
  // aprono. ellyForBaseOrNull valida la base contro quelle configurate.
  const client = await ellyForBaseOrNull(params.get("base"));
  if (!client) return NextResponse.json({ error: "Non autenticato o istanza Elly sconosciuta" }, { status: 401 });
  try {
    const param = params.get("courseid");
    if (!param) {
      return NextResponse.json({ error: "courseid mancante" }, { status: 400 });
    }
    return NextResponse.json(await client.getCourseContents(Number(param)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
