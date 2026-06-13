# unidesk

Web app (Unipr, Scienze Informatiche) che integra Esse3 ed Elly in un'unica
interfaccia, con login per utente. Monorepo a workspace npm: `packages/core` +
`web`.

## Struttura

- `packages/core/` — client condivisi. **Unica fonte** per parlare con
  Esse3/Elly; non duplicare la logica HTTP altrove.
  - `esse3/client.ts` — Basic Auth stateless (header ricalcolato a ogni call).
    Libretto, media, appelli `calesa`, prenotazione/disiscrizione.
  - `elly/client.ts` — login **Shibboleth SSO** via fetch → sessione Moodle +
    sesskey, API AJAX interne; sessione **per-utente** con refresh automatico.
  - `config.ts` — solo base URL (`esse3Base`, `ellyBase`); nessuna credenziale.
- `web/` — Next.js 15 + Ant Design.
  - `app/` — pagine (dashboard, esami, corsi) + login gate in `AppShell`.
  - `app/api/**` — route server-side che wrappano `@unidesk/core`.
  - `app/api/auth/**` + `lib/session.ts` — login/logout/me e sessione cifrata.
  - Le credenziali non lasciano il server.

## Comandi

- `npm install` (dalla root).
- `npm run web` — UI su http://localhost:3000.

## Credenziali e sessione

- Ogni utente fa **login** con le credenziali Unipr; validate su Esse3.
- Conservate **cifrate** in un cookie di sessione (`iron-session`, httpOnly).
- Nel `.env`: `SESSION_SECRET` (obbligatorio) + `ESSE3_BASE`/`ELLY_BASE` (default
  Unipr). Niente credenziali nel codice o nel `.env`.

## Regole

- Le **scritture** (prenotazione/disiscrizione appelli) richiedono conferma
  esplicita nell'interfaccia.
- Nessun dato personale (matId, matricola, CF) committato: si scopre a runtime.
- Repo pubblica; `.env` e `node_modules` in `.gitignore`. Servire in HTTPS in
  produzione (cookie `secure`).
