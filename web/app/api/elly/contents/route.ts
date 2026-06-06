import { NextResponse } from "next/server";
import { ellyClient } from "@unidesk/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const param = new URL(req.url).searchParams.get("courseid");
    if (!param) {
      return NextResponse.json({ error: "courseid mancante" }, { status: 400 });
    }
    return NextResponse.json(
      await ellyClient().getCourseContents(Number(param)),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
