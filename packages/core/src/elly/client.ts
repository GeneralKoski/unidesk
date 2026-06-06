import { ellyConfig, type EllyConfig } from "../config.js";
import type {
  Course,
  MoodleError,
  MoodleTokenResp,
  Section,
  SiteInfo,
} from "./types.js";

const AUTH_ERRORS = new Set([
  "invalidtoken",
  "accessexception",
  "servicenotavailable",
]);

// Moodle (Elly): si ottiene un token col web service mobile e lo si riusa per
// le chiamate REST. Il token può scadere/essere invalidato: il client lo
// rifà in automatico (login automatica) e ritenta la chiamata una volta.
export class EllyClient {
  private token?: string;

  constructor(private readonly cfg: EllyConfig = ellyConfig()) {}

  private async fetchToken(): Promise<string> {
    const url =
      `${this.cfg.base}/login/token.php` +
      `?username=${encodeURIComponent(this.cfg.user)}` +
      `&password=${encodeURIComponent(this.cfg.pass)}` +
      `&service=moodle_mobile_app`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Elly token -> HTTP ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as MoodleTokenResp;
    if (!data.token) {
      throw new Error(`Elly token: ${data.error ?? "nessun token restituito"}`);
    }
    this.token = data.token;
    return data.token;
  }

  private async getToken(): Promise<string> {
    return this.token ?? this.fetchToken();
  }

  private async call<T>(
    wsfunction: string,
    params: Record<string, string> = {},
    retry = true,
  ): Promise<T> {
    const token = await this.getToken();
    const body = new URLSearchParams({
      wstoken: token,
      wsfunction,
      moodlewsrestformat: "json",
      ...params,
    });
    const res = await fetch(`${this.cfg.base}/webservice/rest/server.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      throw new Error(`Elly ${wsfunction} -> HTTP ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as T & MoodleError;
    if (data && typeof data === "object" && "errorcode" in data && data.errorcode) {
      if (retry && AUTH_ERRORS.has(data.errorcode)) {
        this.token = undefined; // token scaduto: ne richiede uno nuovo e ritenta
        return this.call<T>(wsfunction, params, false);
      }
      throw new Error(`Elly ${wsfunction}: ${data.message ?? data.errorcode}`);
    }
    return data as T;
  }

  getSiteInfo(): Promise<SiteInfo> {
    return this.call<SiteInfo>("core_webservice_get_site_info");
  }

  async getCourses(): Promise<Course[]> {
    const info = await this.getSiteInfo();
    return this.call<Course[]>("core_enrol_get_users_courses", {
      userid: String(info.userid),
    });
  }

  getCourseContents(courseid: number): Promise<Section[]> {
    return this.call<Section[]>("core_course_get_contents", {
      courseid: String(courseid),
    });
  }

  // I file Moodle si scaricano dal pluginfile aggiungendo il token in query.
  fileUrl(fileurl: string): string {
    if (!this.token) return fileurl;
    const sep = fileurl.includes("?") ? "&" : "?";
    return `${fileurl}${sep}token=${this.token}`;
  }
}
