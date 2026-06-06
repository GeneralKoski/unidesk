import { NextResponse } from "next/server";
import { Esse3Client } from "@unidesk/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const client = new Esse3Client();
    const param = new URL(req.url).searchParams.get("matId");
    const matId = param ? Number(param) : (await client.getActiveCareer()).matId;
    return NextResponse.json(await client.getDaSostenere(matId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
