import type { EllyConfig } from "../config.js";
import type { Course, Module, Section } from "./types.js";

// Elly (Moodle Unipr) è dietro Shibboleth SSO: niente token mobile (gli account
// SSO non hanno password Moodle locale). Si automatizza il login Shibboleth via
// fetch per ottenere una sessione (cookie + sesskey), poi si chiamano le API
// AJAX interne di Moodle (/lib/ajax/service.php). La sessione viene rinnovata
// in automatico quando scade.

const IDP = "https://shibidp.unipr.it/idp/shibboleth";

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// Estrae action + input (name→value) dell'ennesimo <form> dell'HTML.
function parseForm(html: string, idx = 0): { action: string; inputs: Record<string, string> } {
  const forms = [...html.matchAll(/<form[\s\S]*?<\/form>/gi)].map((m) => m[0]);
  const f = forms[idx] ?? "";
  const action = decodeEntities((f.match(/action="([^"]+)"/i) ?? [])[1] ?? "");
  const inputs: Record<string, string> = {};
  for (const m of f.matchAll(/<input\b[^>]*>/gi)) {
    const name = (m[0].match(/name="([^"]+)"/i) ?? [])[1];
    if (name) inputs[name] = decodeEntities((m[0].match(/value="([^"]*)"/i) ?? [])[1] ?? "");
  }
  return { action, inputs };
}

// Cache per-utente: il login SSO è costoso (più round-trip), quindi si riusa
// la sessione Moodle tra le richieste, separata per ogni utente, e si rifà solo
// quando scade. La chiave è l'username (le credenziali arrivano dalla sessione).
const clients = new Map<string, EllyClient>();
export function ellyClient(cfg: EllyConfig): EllyClient {
  let c = clients.get(cfg.user);
  if (!c) {
    c = new EllyClient(cfg);
    clients.set(cfg.user, c);
  }
  return c;
}

interface Session {
  cookie: string;
  sesskey: string;
}

export class EllyClient {
  private session?: Session;

  constructor(private readonly cfg: EllyConfig) {}

  private async login(): Promise<Session> {
    const jar: Record<string, string> = {};
    const cookie = () =>
      Object.entries(jar)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    const store = (res: Response) => {
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const eq = c.indexOf("=");
        const name = c.slice(0, eq).trim();
        const value = c.slice(eq + 1).split(";")[0];
        if (name) jar[name] = value;
      }
    };

    // Segue i redirect mantenendo i cookie (fetch non ha un cookie jar).
    type Init = { method?: string; headers?: Record<string, string>; body?: string | URLSearchParams };
    const go = async (url: string, init: Init = {}): Promise<{ url: string; html: string }> => {
      let cur = url;
      for (let i = 0; i < 12; i++) {
        const res = await fetch(cur, {
          ...init,
          redirect: "manual",
          headers: { ...(init.headers ?? {}), Cookie: cookie() },
        });
        store(res);
        const loc = res.headers.get("location");
        if (loc && res.status >= 300 && res.status < 400) {
          cur = new URL(loc, cur).toString();
          init = {};
          continue;
        }
        return { url: cur, html: await res.text() };
      }
      throw new Error("Elly login: troppi redirect");
    };
    const post = (url: string, body: Record<string, string>, base: string) =>
      go(new URL(url, base).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body),
      });

    // 1. SP-initiated SSO → interstiziale IdP "Loading Session Information".
    let r = await post("/auth/shibboleth/login.php", { idp: IDP }, this.cfg.base);
    // 2. supera l'interstiziale (senza JS: shib_idp_ls_supported=false).
    let f = parseForm(r.html);
    r = await post(f.action, { ...f.inputs, shib_idp_ls_supported: "false" }, r.url);
    // 3. form di login IdP: invia le credenziali Unipr.
    f = parseForm(r.html);
    r = await post(
      f.action,
      { ...f.inputs, j_username: this.cfg.user, j_password: this.cfg.pass, _eventId_proceed: "" },
      r.url,
    );
    // 4. auto-submit della SAMLResponse verso il SP → sessione Moodle.
    f = parseForm(r.html);
    if (!f.inputs.SAMLResponse) {
      throw new Error("Elly login fallito: credenziali errate o flusso SSO cambiato.");
    }
    r = await post(f.action, f.inputs, r.url);

    const sesskey = (r.html.match(/"sesskey":"([^"]+)"/) ?? [])[1];
    if (!sesskey) throw new Error("Elly login: sesskey non trovato dopo l'SSO.");
    return { cookie: cookie(), sesskey };
  }

  private async getSession(): Promise<Session> {
    return (this.session ??= await this.login());
  }

  // Chiamata all'API AJAX interna di Moodle. Rinnova la sessione e ritenta una
  // volta se scaduta. `data` è già l'oggetto della singola chiamata.
  private async ajax<T>(methodname: string, args: unknown, retry = true): Promise<T> {
    const { cookie, sesskey } = await this.getSession();
    const res = await fetch(
      `${this.cfg.base}/lib/ajax/service.php?sesskey=${sesskey}&info=${methodname}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify([{ index: 0, methodname, args }]),
      },
    );
    const body = (await res.json()) as Array<{
      error?: boolean;
      exception?: { errorcode?: string; message?: string };
      data?: unknown;
    }>;
    const item = body?.[0];
    if (item?.error) {
      const code = item.exception?.errorcode ?? "";
      if (retry && /sesskey|session|loginrequired|servicerequireslogin/i.test(code)) {
        this.session = undefined; // sessione scaduta: re-login e ritenta
        return this.ajax<T>(methodname, args, false);
      }
      throw new Error(`Elly ${methodname}: ${item.exception?.message ?? code}`);
    }
    return item.data as T;
  }

  async getCourses(): Promise<Course[]> {
    const data = await this.ajax<{ courses: Course[] }>(
      "core_course_get_enrolled_courses_by_timeline_classification",
      { classification: "all", limit: 0, offset: 0, sort: "fullname" },
    );
    return data.courses ?? [];
  }

  // Risolve l'URL di un modulo (es. /mod/resource/view.php?id=X) usando la
  // sessione: segue i redirect Moodle e restituisce o i byte del file, o un
  // redirect verso una destinazione esterna (es. moduli "url"). Serve al proxy
  // di download, dato che il browser non ha la sessione (sta solo lato server).
  async resolveFile(
    rawUrl: string,
  ): Promise<
    | { kind: "file"; data: ArrayBuffer; contentType: string; filename: string }
    | { kind: "redirect"; location: string }
  > {
    const baseHost = new URL(this.cfg.base).host;
    if (new URL(rawUrl).host !== baseHost) {
      throw new Error("URL non appartiene a Elly");
    }
    const { cookie } = await this.getSession();
    let cur = rawUrl;
    for (let i = 0; i < 10; i++) {
      const res = await fetch(cur, { redirect: "manual", headers: { Cookie: cookie } });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) break;
        const next = new URL(loc, cur);
        if (next.host !== baseHost) return { kind: "redirect", location: next.toString() };
        cur = next.toString();
        continue;
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (!/text\/html/i.test(contentType)) {
        const data = await res.arrayBuffer();
        const cd = res.headers.get("content-disposition") ?? "";
        const filename =
          cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1] ??
          decodeURIComponent(cur.split("/").pop()?.split("?")[0] ?? "file");
        return { kind: "file", data, contentType: contentType || "application/octet-stream", filename };
      }
      // Pagina HTML (resource "embed", ecc.): cerca un link al file pluginfile.
      const html = await res.text();
      const m = html.match(/https?:\/\/[^"']*\/pluginfile\.php\/[^"']+/i);
      if (m) {
        // Valida l'host prima di seguirlo col cookie di sessione: una pagina
        // ostile potrebbe puntare altrove (SSRF / leak del cookie).
        const candidate = new URL(m[0].replace(/&amp;/g, "&"));
        if (candidate.host !== baseHost) {
          return { kind: "redirect", location: candidate.toString() };
        }
        cur = candidate.toString();
        continue;
      }
      return { kind: "redirect", location: cur };
    }
    throw new Error("Impossibile risolvere il file Elly");
  }

  async getCourseContents(courseid: number): Promise<Section[]> {
    // get_state restituisce `data` come stringa JSON con course/section/cm.
    const raw = await this.ajax<string>("core_courseformat_get_state", { courseid });
    const state = JSON.parse(raw) as {
      section: Array<{ id: string; number: number; title: string; cmlist: string[]; visible: boolean }>;
      cm: Array<{ id: string; name: string; module: string; modname: string; url?: string; uservisible: boolean }>;
    };
    const cmById = new Map(state.cm.map((m) => [String(m.id), m]));

    return state.section
      .filter((s) => s.visible && s.cmlist.length > 0)
      .sort((a, b) => a.number - b.number)
      .map((s) => ({
        id: Number(s.id),
        name: s.title,
        section: s.number,
        modules: s.cmlist
          .map((id) => cmById.get(String(id)))
          .filter((m): m is NonNullable<typeof m> => Boolean(m && m.uservisible))
          .map(
            (m): Module => ({
              id: Number(m.id),
              name: m.name,
              modname: m.module, // "resource" | "url" | "folder" | "forum" | ...
              url: m.url,
            }),
          ),
      }));
  }
}
