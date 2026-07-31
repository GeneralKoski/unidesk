# unidesk

A web dashboard that pulls the two systems my university runs on into one
interface: Esse3 for academic records and exam booking, Elly (a Moodle instance)
for courses and course materials. Each user logs in with their own university
credentials.

Neither system offers a public API or OAuth, so the interesting part of the
project was working out how to talk to them: Esse3 exposes an internal REST API
that accepts stateless HTTP Basic auth, while Elly sits behind Shibboleth SSO and
needed the login flow automated with plain `fetch`, no browser and no scraping.

## Stack

- Node 22, TypeScript, npm workspaces monorepo
- Next.js 15 (App Router) and Ant Design in `web/`
- `packages/core`: the shared Esse3 and Elly clients, the single place that speaks HTTP to either system
- `iron-session` for the encrypted session cookie
- No runtime dependencies in the core beyond what Node provides

Credentials never leave the server. The API routes run server-side, read the
credentials from an encrypted `httpOnly` cookie and call Esse3 or Elly on the
user's behalf. Course material downloads go through a server-side proxy, since
the browser does not hold the Moodle session; the proxy validates the host and
forces HTML and SVG to download rather than render.

Writes (booking and cancelling an exam) always require an explicit confirmation
in the interface.

## Running locally

Requires Node 22 or later.

```bash
npm install

cp .env.example .env
# set SESSION_SECRET to at least 32 characters, for example:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npm run web   # http://localhost:3000
```

`ESSE3_BASE` and `ELLY_BASE` default to my university's endpoints. No credentials
belong in `.env` or in the code: they are entered at login. Sessions last 30
days, and the Moodle session is renewed automatically when it expires.

## Status

Working end to end and verified against real accounts: academic record, weighted
average, exam sessions, booking and cancelling, course list, course contents and
material downloads. Not implemented: filling in the OPIS questionnaire in-app,
which Esse3 sometimes requires before booking, so the interface links out to
Esse3 for that step.

A caveat worth stating plainly, since this is a personal project rather than a
service: the application acts as a broker for university passwords, because
neither Esse3 nor Elly issues tokens. Whoever operates the server can
technically reach them. It must be served over HTTPS, and it is not meant to be
run as a shared deployment for people who cannot audit it.
