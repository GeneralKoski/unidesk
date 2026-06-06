# unidesk

Scrivania di lavoro automatizzata per i corsi universitari. Un orchestratore con
agenti specializzati che integra le fonti dell'ateneo - Elly (Moodle) ed Esse3 -
e per ogni esame costruisce un ambiente completo: scarica e organizza i materiali,
sintetizza i PDF, scrive ed esegue codice, tiene traccia di date e prenotazioni.

Università di Parma · Laurea Magistrale in Scienze Informatiche.

## Cos'è (e cosa non è)

`unidesk` non è "lo script per Esse3". È il livello che mette insieme tutte le
fonti universitarie e le espone a un orchestratore (Claude Code) che coordina
agenti e sub-agenti. Le singole API (Esse3, Elly) sono dettagli di
implementazione dietro un'interfaccia stabile.

Due concetti distinti convivono nella repo:

* **unimcp** - il server MCP che parla con Esse3, Elly, GitHub e il filesystem,
  ed espone tutto come tool.
* **orchestratore** - Claude Code + skill che usano quei tool per fare il lavoro
  vero, un corso alla volta.

## Architettura

```
Orchestratore (Claude Code)
        │  coordina e fa spawn di sub-agenti
        ▼
Agenti  ── Materiali · Codice · Riassunti · Esami
        │  ogni agente chiama gli stessi tool
        ▼
Server MCP (unimcp)
        │
        ▼
Fonti   ── Esse3 (REST) · Elly (Moodle) · GitHub · Filesystem
```

## Stato attuale

* **Esse3: confermato funzionante, scritture incluse.** L'API REST interna
  (`e3rest`) accetta HTTP Basic Auth con credenziali email + password e risponde
  in JSON pulito. Niente browser, niente scraping. Verificato end-to-end con
  credenziali reali: `login` → carriera attiva → libretto + media ponderata →
  appelli (`calesa`) → **prenotazione e disiscrizione** a un appello (con
  conferma esplicita; gestito anche il blocco "questionario OPIS da compilare").
* **Elly: confermato funzionante.** Dietro Shibboleth SSO (niente token mobile):
  login automatizzato all'IdP Unipr via fetch → sessione Moodle → API AJAX
  interne. Verificato end-to-end: elenco corsi, contenuti (sezioni/moduli) e
  **download materiali** tramite proxy server-side.

## Fonti dati

### Esse3 - REST (`e3rest`)

* Base: `https://<ateneo>.esse3.cineca.it/e3rest/api`
* Auth: **HTTP Basic a ogni chiamata** (stateless). Il `login` restituisce anche
  un `authToken`, ma scade in 15 minuti e non serve gestirlo se si usa Basic.
* `GET /login` → dati utente e `trattiCarriera[]`. La carriera attiva è quella
  con `staStuCod === "A"` (le altre, es. una triennale conclusa, hanno `"X"`).
  Da qui si ricava il `matId` da usare nelle chiamate successive.
* `GET /libretto-service-v2/libretti/{matId}/righe` → libretto.  **Provare v2,
  ripiegare su v1** : la versione del service cambia da ateneo ad ateneo.
* `calesa-service-v1` → appelli e prenotazioni (confermato su Unipr, path param):
  * `GET …/appelli/{cdsId}/{adId}` → elenco appelli dell'insegnamento.
  * `GET …/prenotazioni/{matId}` → prenotazioni dell'utente (con `dataIns`,
    `dataEsa`, `adsceId`, `appId`).
  * `POST …/appelli/{cdsId}/{adId}/{appId}/iscritti` body `{adsceId}` → **prenota**.
  * `DELETE …/appelli/{cdsId}/{adId}/{appId}/iscritti/{stuId}` → **disiscrivi**.
  * `adsceId` e `stuId` si leggono dalla riga di libretto. Prima della
    prenotazione Esse3 può richiedere il questionario OPIS (`questionari-service-v1`).

Mapping dei campi rilevanti del libretto:

| Campo                            | Significato                                              |
| -------------------------------- | -------------------------------------------------------- |
| `stato.value`                  | `S`= superata,`F`= frequentata (non ancora superata) |
| `peso`                         | CFU                                                      |
| `esito.voto`,`esito.dataEsa` | voto e data dell'esame                                   |
| `tipoInsDes`                   | Obbligatorio / Opzionale                                 |
| `numAppelliPrenotabili`        | appelli aperti alla prenotazione                         |
| `numPrenotazioni`              | `> 0`= già prenotato                                  |
| `chiaveADContestualizzata`     | contiene `adId`,`afId`,`cdsId`per `calesa`       |

### Elly - Moodle (Shibboleth SSO)

Elly Unipr è dietro **Shibboleth SSO** (IdP `shibidp.unipr.it`, stesse
credenziali Unipr di Esse3). Il token mobile (`/login/token.php`) **non**
funziona: gli account SSO non hanno password Moodle locale (`invalidlogin`) e il
flusso mobile launch è disabilitato. Si automatizza quindi il login SSO via
`fetch` (zero dipendenze, niente browser):

1. `POST /auth/shibboleth/login.php` con `idp` → interstiziale IdP (si supera
   con `shib_idp_ls_supported=false`).
2. Form IdP: `POST` con `j_username`/`j_password` → `SAMLResponse`.
3. Auto-submit della `SAMLResponse` al SP → sessione Moodle (`MoodleSession`) +
   `sesskey` estratto dalla pagina.

Con la sessione si chiamano le **API AJAX interne** (`/lib/ajax/service.php`):

* `core_course_get_enrolled_courses_by_timeline_classification` → elenco corsi.
* `core_courseformat_get_state` → sezioni + moduli (nome, tipo, url). NB:
  `core_*_get_contents` non è AJAX-callable, questo lo sostituisce.
* Download materiali: proxy server-side (`/api/elly/file`) che segue i redirect
  Moodle col cookie di sessione e serve il file (il browser non ha la sessione).
  Solo tipi sicuri inline; HTML/SVG forzati a download (anti-XSS), host validato
  (anti-SSRF). La sessione è condivisa tra le richieste e rinnovata se scade.

## Sicurezza (non negoziabile)

Questo progetto maneggia credenziali universitarie reali. Regole vincolanti:

* Credenziali **solo** da variabili d'ambiente o keychain di sistema. Mai
  hardcoded nel codice, mai passate come argomento da riga di comando (finiscono
  nella shell history e in `ps aux`).
* `.gitignore` deve escludere `.env`, file di credenziali e `node_modules`
  **prima** del primo commit.
* Repo  **privata** .
* Nessun identificativo personale (matId, codice fiscale, matricola) committato:
  si scoprono a runtime dal `login`.
* Le **scritture** (es. prenotazione di un appello, POST su `calesa`) richiedono
  una conferma esplicita prima di essere eseguite. Mai prenotare in automatico
  senza un "sì" intenzionale.

## Avvio rapido

Prerequisiti: Node 22+.

```bash
# 1. dipendenze (monorepo a workspace npm: installa core, unimcp e web)
npm install

# 2. credenziali - mai committate (.env è in .gitignore)
cp .env.example .env
#    poi compila ESSE3_* ed ELLY_* nel .env.
#    NB: verifica ELLY_BASE - l'URL del Moodle cambia per dipartimento/anno.

# 3a. interfaccia web (Esse3 + Elly da browser) → http://localhost:3000
npm run web

# 3b. server MCP (per l'orchestratore Claude Code), su stdio
npm run mcp
```

Le credenziali si leggono **solo** dal `.env` alla root, lette server-side: la
login è automatica (Basic Auth per Esse3, SSO Shibboleth per Elly) e la sessione
Elly viene rinnovata da sola quando scade - niente login manuale ripetuta.

## Struttura

```
unidesk/
  .env.example          # nomi delle variabili, senza valori
  package.json          # workspace: packages/* + unimcp + web
  packages/core/        # client condivisi (unica fonte): config, Esse3, Elly
  unimcp/               # server MCP: espone i client come tool (sola lettura)
  web/                  # Next.js 15 + Ant Design: UI + API route server-side
  skills/               # (previsto) workflow ricorrenti: download, sintesi, ...
  corsi/                # (previsto)
    <nome-corso>/
      .corso.yaml       # docente, CFU, date, id su Esse3/Elly
      CLAUDE.md         # istruzioni specifiche del corso
      materiali/        # PDF scaricati da Elly
      appunti/  codice/  riassunti/
```

## Stack

* Node 22, TypeScript, esecuzione con `tsx` (nessuna build per gli spike).
* `@modelcontextprotocol/sdk` per il server MCP.
* Claude Code come orchestratore (Task tool per i sub-agenti, skill per i
  workflow).
* Zero dipendenze runtime dove possibile: `fetch` e `Buffer` sono nativi.

## Roadmap

* [X] Spike Esse3: login → carriera attiva → libretto
* [X] Client Esse3/Elly condivisi (`packages/core`) + UI web (Next.js + AntD)
* [X] Server `unimcp`: wrapping dei tool confermati (sola lettura)
* [X] `calesa`: appelli + stato prenotazioni (confermato live)
* [X] Prenotazione/disiscrizione appelli (scrittura, **con conferma esplicita**)
* [X] Elly: login SSO Shibboleth + corsi/contenuti + proxy download materiali
* [ ] Skill per i workflow + `CLAUDE.md` per corso
* [ ] Compilatore questionario OPIS in-app (ora: avviso + link a Esse3)
* [ ] Migrazione credenziali da env a keychain
