# unidesk

Web app che mette insieme le fonti dell'ateneo — Esse3 ed Elly (Moodle) — in
un'unica interfaccia: carriera e libretto, prenotazione appelli, corsi e
materiali. Ogni utente accede con le proprie credenziali Unipr.

Università di Parma · Laurea Magistrale in Scienze Informatiche.

## Architettura

```
Browser (Next.js + Ant Design)
        │  fetch alle API route
        ▼
API route server-side (Next.js)  ── credenziali dalla sessione cifrata
        │
        ▼
@unidesk/core  ── client Esse3 (REST) e Elly (Moodle via SSO)
        │
        ▼
Fonti   ── Esse3 (e3rest) · Elly (Moodle Shibboleth)
```

Le credenziali non lasciano mai il server: le API route girano in Node, leggono
le credenziali dalla sessione e chiamano Esse3/Elly per conto dell'utente.

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

## Sicurezza

Questo progetto maneggia credenziali universitarie reali. Regole vincolanti:

* **Login per utente**: ogni utente inserisce le proprie credenziali Unipr. Sono
  validate su Esse3 e poi conservate **cifrate** in un cookie di sessione
  (`iron-session`, httpOnly): JS non le legge, solo il server le decifra.
* **Niente credenziali nel codice o nel `.env`** per la web app. Nel `.env` solo
  `SESSION_SECRET` (chiave di cifratura) e le base URL.
* `.gitignore` esclude `.env` e `node_modules`. Repo **privata**.
* Nessun identificativo personale (matId, CF, matricola) committato: si scoprono
  a runtime dal login.
* Le **scritture** (prenotazione/disiscrizione appelli) richiedono conferma
  esplicita nell'interfaccia.
* L'app fa da **broker** delle password Unipr (Esse3/Elly non offrono token):
  chi gestisce il server può tecnicamente accedervi → va servita in HTTPS e gli
  utenti devono fidarsi del deployment.

## Avvio rapido

Prerequisiti: Node 22+.

```bash
# 1. dipendenze (monorepo a workspace npm)
npm install

# 2. configurazione (.env è in .gitignore)
cp .env.example .env
#    genera SESSION_SECRET (>= 32 caratteri):
#    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#    ESSE3_BASE/ELLY_BASE hanno già default Unipr.

# 3. interfaccia web → http://localhost:3000
npm run web
```

All'avvio l'app mostra il **login**: si entra con le credenziali Unipr (le stesse
di Esse3/Elly). La sessione dura 30 giorni; per Elly la sessione Moodle viene
rinnovata da sola quando scade.

## Struttura

```
unidesk/
  .env.example          # SESSION_SECRET + base URL
  package.json          # workspace: packages/* + web
  packages/core/        # client condivisi: config, Esse3, Elly
  web/                  # Next.js 15 + Ant Design: UI + API route + auth/sessione
```

## Stack

* Node 22, TypeScript.
* Next.js 15 (App Router) + Ant Design.
* `iron-session` per la sessione cifrata.
* Zero dipendenze runtime dove possibile nel core: `fetch` e `Buffer` sono nativi.

## Roadmap

* [X] Esse3: carriera, libretto, media ponderata
* [X] `calesa`: appelli + stato prenotazioni; prenotazione/disiscrizione (con conferma)
* [X] Elly: login SSO Shibboleth + corsi/contenuti + proxy download materiali
* [X] UI web (Next.js + AntD): dashboard, esami, corsi
* [X] Login multi-utente con sessione cifrata in cookie
* [ ] Compilatore questionario OPIS in-app (ora: avviso + link a Esse3)
* [ ] Deploy pubblico (HTTPS) per i colleghi
