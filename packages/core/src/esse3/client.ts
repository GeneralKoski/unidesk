import { esse3Config, type Esse3Config } from "../config.js";
import type {
  Appello,
  AppelloConStato,
  Libretto,
  LibrettoStats,
  LoginResp,
  Presa,
  RigaDaSostenere,
  RigaLibretto,
  TrattoCarriera,
} from "./types.js";

// Le date calesa arrivano come "dd/MM/yyyy" (eventualmente con orario): non
// sono ISO, quindi Date.parse fallisce. Estraggo la parte data come ms UTC.
function parseEsse3Date(s: string | undefined): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s ?? "");
  return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : null;
}

function startOfTodayUTC(): number {
  const d = new Date();
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

// e3rest accetta Basic Auth a ogni chiamata: è stateless, non serve gestire
// authToken né sessione (che scade in 15 min). La "login automatica" qui è
// semplicemente l'header Authorization ricalcolato dal client a ogni richiesta.
export class Esse3Client {
  private readonly auth: string;

  constructor(private readonly cfg: Esse3Config = esse3Config()) {
    this.auth =
      "Basic " + Buffer.from(`${cfg.user}:${cfg.pass}`).toString("base64");
  }

  private async api<T>(
    path: string,
    init?: { method?: string; body?: unknown },
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: this.auth,
      Accept: "application/json",
    };
    if (init?.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${this.cfg.base}${path}`, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    // Le scritture possono rispondere con corpo vuoto.
    const text = await res.text();
    if (!res.ok) {
      let msg = `HTTP ${res.status} ${res.statusText}`;
      try {
        const j = JSON.parse(text);
        msg = j?.retErrMsg ?? j?.errDetails?.[0]?.errorType ?? msg;
      } catch {
        /* corpo non JSON */
      }
      throw new Error(`Esse3 ${path} -> ${msg}`);
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  login(): Promise<LoginResp> {
    return this.api<LoginResp>("/login");
  }

  async getCarriere(): Promise<TrattoCarriera[]> {
    const { user } = await this.login();
    return user.trattiCarriera;
  }

  async getActiveCareer(): Promise<TrattoCarriera> {
    const carriere = await this.getCarriere();
    const attiva = carriere.find((t) => t.staStuCod === "A");
    if (!attiva) throw new Error("Nessuna carriera con stato attivo trovata.");
    return attiva;
  }

  // Le versioni dei service cambiano da ateneo ad ateneo: prova v2, ripiega v1.
  async getLibrettoRighe(matId: number): Promise<RigaLibretto[]> {
    for (const v of ["v2", "v1"] as const) {
      try {
        return await this.api<RigaLibretto[]>(
          `/libretto-service-${v}/libretti/${matId}/righe`,
        );
      } catch (err) {
        if (v === "v1") throw err;
      }
    }
    return [];
  }

  async getLibretto(matId: number): Promise<Libretto> {
    const righe = await this.getLibrettoRighe(matId);
    const superate = righe.filter((r) => r.stato.value === "S");
    const daFare = righe.filter((r) => r.stato.value !== "S");

    const cfuFatti = superate.reduce((s, r) => s + r.peso, 0);
    const conVoto = superate.filter((r) => r.esito.voto != null);
    const sommaPesata = conVoto.reduce(
      (s, r) => s + (r.esito.voto as number) * r.peso,
      0,
    );
    const pesoTot = conVoto.reduce((s, r) => s + r.peso, 0);

    const stats: LibrettoStats = {
      esamiSuperati: superate.length,
      cfuFatti,
      mediaPonderata: pesoTot ? sommaPesata / pesoTot : 0,
      esamiDaFare: daFare.length,
      cfuRimasti: daFare.reduce((s, r) => s + r.peso, 0),
    };

    return { righe, superate, daFare, stats };
  }

  // --- calesa: appelli e prenotazioni ---
  // Endpoint confermati su Unipr: calesa-service-v1 con path param.
  async getAppelli(cdsId: number, adId: number): Promise<Appello[]> {
    return this.api<Appello[]>(`/calesa-service-v1/appelli/${cdsId}/${adId}`);
  }

  // Prenotazioni dell'utente per la carriera (per sapere a cosa è iscritto).
  async getPrenotazioni(matId: number): Promise<Presa[]> {
    return this.api<Presa[]>(`/calesa-service-v1/prenotazioni/${matId}`);
  }

  // Appelli di un insegnamento arricchiti con lo stato dell'utente:
  // `prenotato` (è iscritto) e `prenotabile` (finestra iscrizioni aperta ora).
  async getAppelliConStato(
    matId: number,
    cdsId: number,
    adId: number,
  ): Promise<AppelloConStato[]> {
    const [appelli, prese] = await Promise.all([
      this.getAppelli(cdsId, adId),
      this.getPrenotazioni(matId).catch(() => [] as Presa[]),
    ]);
    const iscritto = new Set(
      prese.filter((p) => p.adId === adId).map((p) => p.appId),
    );
    const oggi = startOfTodayUTC();
    return appelli
      .filter((a) => {
        const esame = parseEsse3Date(a.dataInizioApp);
        return esame !== null && esame >= oggi; // solo date esame future
      })
      .sort(
        (a, b) =>
          (parseEsse3Date(a.dataInizioApp) ?? 0) -
          (parseEsse3Date(b.dataInizioApp) ?? 0),
      )
      .map((a) => {
        const apertura = parseEsse3Date(a.dataInizioIscr);
        const chiusura = parseEsse3Date(a.dataFineIscr);
        let iscrizioni: AppelloConStato["iscrizioni"] = "chiusa";
        if (apertura !== null && oggi < apertura) iscrizioni = "futura";
        else if (chiusura !== null && oggi <= chiusura) iscrizioni = "aperta";
        return {
          ...a,
          prenotato: iscritto.has(a.appId),
          prenotabile: iscrizioni === "aperta",
          iscrizioni,
        };
      });
  }

  // Righe da sostenere arricchite con lo stato prenotazione, per la dashboard.
  // Le prenotazioni dell'utente portano già data prenotazione (dataIns) ed
  // esame (dataEsa): nessuna chiamata appelli per le righe già prenotate. Per
  // le righe solo prenotabili si recupera il primo appello con finestra aperta.
  async getDaSostenere(matId: number): Promise<RigaDaSostenere[]> {
    const [{ daFare }, prese] = await Promise.all([
      this.getLibretto(matId),
      this.getPrenotazioni(matId).catch(() => [] as Presa[]),
    ]);
    const presaByAd = new Map(prese.map((p) => [p.adId, p]));
    const oggi = startOfTodayUTC();

    return Promise.all(
      daFare.map(async (r): Promise<RigaDaSostenere> => {
        const { adId, cdsId } = r.chiaveADContestualizzata;
        const presa = presaByAd.get(adId);

        // Sia prenotato sia prenotabile servono la data esame dell'appello.
        if (r.numPrenotazioni > 0 && presa) {
          const appelli = await this.getAppelli(cdsId, adId).catch(
            () => [] as Appello[],
          );
          const appello = appelli.find((a) => a.appId === presa.appId);
          return {
            ...r,
            prenotazione: {
              stato: "prenotato",
              dataPrenotazione: presa.dataIns,
              dataAppello: appello?.dataInizioApp ?? presa.dataEsa,
            },
          };
        }

        if (r.numAppelliPrenotabili > 0) {
          const appelli = await this.getAppelli(cdsId, adId).catch(
            () => [] as Appello[],
          );
          const primo = appelli
            .filter((a) => {
              const ap = parseEsse3Date(a.dataInizioIscr);
              const ch = parseEsse3Date(a.dataFineIscr);
              return ap !== null && ch !== null && oggi >= ap && oggi <= ch;
            })
            .sort(
              (a, b) =>
                (parseEsse3Date(a.dataInizioApp) ?? Infinity) -
                (parseEsse3Date(b.dataInizioApp) ?? Infinity),
            )[0];
          return {
            ...r,
            prenotazione: {
              stato: "prenotabile",
              dataPrenotazione: null,
              dataAppello: primo?.dataInizioApp ?? null,
            },
          };
        }

        return {
          ...r,
          prenotazione: {
            stato: "nessuno",
            dataPrenotazione: null,
            dataAppello: null,
          },
        };
      }),
    );
  }

  // SCRITTURA - richiede conferma esplicita lato chiamante (vedi README).
  // Iscrizione studente: POST sulla lista iscritti dell'appello, con l'adsceId
  // della riga di libretto (ParametriIscrizioneAppello).
  prenota(
    cdsId: number,
    adId: number,
    appId: number,
    adsceId: number,
  ): Promise<unknown> {
    return this.api(
      `/calesa-service-v1/appelli/${cdsId}/${adId}/${appId}/iscritti`,
      { method: "POST", body: { adsceId } },
    );
  }

  // SCRITTURA - richiede conferma esplicita lato chiamante (vedi README).
  // La cancellazione usa stuId nel path (non adsceId).
  disiscrivi(
    cdsId: number,
    adId: number,
    appId: number,
    stuId: number,
  ): Promise<unknown> {
    return this.api(
      `/calesa-service-v1/appelli/${cdsId}/${adId}/${appId}/iscritti/${stuId}`,
      { method: "DELETE" },
    );
  }
}
