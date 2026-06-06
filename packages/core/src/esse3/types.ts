export interface TrattoCarriera {
  matId: number;
  cdsDes: string;
  staStuCod: string; // "A" = attivo, "X" = cessato
  staStuDes: string;
  dettaglioTratto: { annoCorso: number; cdsId: number; tipoCorsoCod: string };
}

export interface LoginResp {
  user: {
    firstName: string;
    lastName: string;
    trattiCarriera: TrattoCarriera[];
  };
}

export interface RigaLibretto {
  adDes: string;
  peso: number; // CFU
  tipoInsDes: string; // Obbligatorio / Opzionale
  stato: { value: string }; // "S" superata, "F" frequentata
  esito: { voto: number | null; dataEsa: string };
  numAppelliPrenotabili: number;
  numPrenotazioni: number;
  adsceId: number; // id AD-scelta dello studente, serve per la prenotazione
  stuId: number; // id studente, serve per la disiscrizione
  chiaveADContestualizzata: { adId: number; afId: number; cdsId: number };
}

export interface LibrettoStats {
  esamiSuperati: number;
  cfuFatti: number;
  mediaPonderata: number;
  esamiDaFare: number;
  cfuRimasti: number;
}

export interface Libretto {
  righe: RigaLibretto[];
  superate: RigaLibretto[];
  daFare: RigaLibretto[];
  stats: LibrettoStats;
}

// --- calesa: appelli e prenotazioni ---
// NB: forma dei campi best-guess, da confermare live con e3rest reale.

export interface Appello {
  appId: number;
  adId: number;
  cdsId: number;
  desApp: string; // descrizione appello
  dataInizioApp: string; // data dell'esame
  dataInizioIscr: string; // apertura iscrizioni
  dataFineIscr: string; // chiusura iscrizioni
  numIscritti: number;
  note: string | null;
}

export interface Presa {
  appId: number;
  adId: number;
  cdsId: number;
  dataIns: string; // data della prenotazione
  dataEsa: string | null; // data dell'esame prenotato
}

export interface PrenotazioneInfo {
  stato: "prenotato" | "prenotabile" | "nessuno";
  dataPrenotazione: string | null; // valorizzata se prenotato
  dataAppello: string | null; // esame prenotato, o primo appello prenotabile
}

export interface RigaDaSostenere extends RigaLibretto {
  prenotazione: PrenotazioneInfo;
}

export interface AppelloConStato extends Appello {
  prenotato: boolean; // l'utente è iscritto a questo appello
  prenotabile: boolean; // finestra di iscrizione aperta ora
  iscrizioni: "futura" | "aperta" | "chiusa"; // stato della finestra
}
