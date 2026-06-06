import { NextResponse } from "next/server";
import { ellyClient } from "@unidesk/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Proxy: scarica il materiale Elly con la sessione server-side e lo serve al
// browser (che la sessione non ce l'ha). I moduli "url" rimandano all'esterno.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url).searchParams.get("url");
    if (!url) {
      return NextResponse.json({ error: "url mancante" }, { status: 400 });
    }
    const r = await ellyClient().resolveFile(url);
    if (r.kind === "redirect") {
      return NextResponse.redirect(r.location);
    }
    // Sicurezza: il contenuto arriva da Moodle (non fidato) ma è servito dalla
    // nostra origin. Solo tipi noti-sicuri vengono mostrati inline; tutto il
    // resto (HTML, SVG, …) è forzato a download come octet-stream.
    const INLINE_OK = new Set([
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
    ]);
    const baseType = r.contentType.split(";")[0].trim().toLowerCase();
    const inline = INLINE_OK.has(baseType);
    const filename = r.filename.replace(/[\r\n"]/g, "");
    return new Response(r.data, {
      headers: {
        "Content-Type": inline ? r.contentType : "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
