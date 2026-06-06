# unidesk - istruzioni per l'orchestratore

Scrivania universitaria (Unipr, Scienze Informatiche). Integra Esse3 ed Elly e
le espone come tool MCP, più una UI web per consultarle.

## Struttura

- `packages/core/` - client condivisi e config. **Unica fonte** per parlare con
  Esse3/Elly: sia `unimcp` sia `web` importano da `@unidesk/core`. Non duplicare
  la logica HTTP altrove.
  - `esse3/client.ts` - Basic Auth stateless (header ricalcolato a ogni call).
  - `elly/client.ts` - login **Shibboleth SSO** via fetch → sessione Moodle +
    sesskey, API AJAX interne; sessione condivisa con **refresh automatico**.
  - `config.ts` - credenziali dal `.env` alla root (mai hardcoded).
- `unimcp/` - server MCP (stdio). Tool: `status`, `esse3_carriere`,
  `esse3_libretto`, `esse3_appelli`, `elly_courses`, `elly_course_contents`.
- `web/` - Next.js 15 + Ant Design. Le API route (`app/api/**`) girano
  server-side e wrappano `@unidesk/core`; le credenziali non lasciano il server.

## Comandi

- `npm install` (dalla root) - installa tutti i workspace.
- `npm run web` - UI su http://localhost:3000.
- `npm run mcp` - avvia il server MCP su stdio.

## Regole vincolanti (sicurezza)

- Credenziali **solo** da `.env`/keychain. Mai hardcoded, mai da argomento CLI.
- Le **scritture** (prenotazione appelli, POST `calesa`) richiedono conferma
  esplicita dell'utente. Tutto ciò che è esposto ora è in **sola lettura**.
- Nessun dato personale (matId, matricola, CF) committato: si scopre a runtime.
- Repo privata; `.env` e `node_modules` già in `.gitignore`.

## Stato

- Esse3: confermato (login → carriera attiva → libretto + media).
- Elly: client implementato sul web service mobile; `ELLY_BASE` va verificato
  per dipartimento. Fallback Playwright non ancora necessario.
- `calesa` (appelli): probe sola lettura, endpoint da confermare per ateneo.
