---
name: founder360
description: How this founder360 live app talks to the company's data API — the SDK surface and retry semantics, that writes execute immediately with no approval step, how to discover what's connected (f360 whoami/types, openapi()), limits and reserved paths, and how f360 dev/deploy work. Load this before writing or changing any code in this project.
---
# founder360 app

This project is a **founder360 live app**: a small web app built against the company's
own data API (`https://api.founder360.ai/v1`) via `@founder360/sdk`, hosted at
`https://<id>.founder360.app` once deployed (`<id>` is a random 12-character code assigned on the first deploy and kept for every later version). It reads (and can write) whatever the
company has connected — shop platform, ads, email/CRM, and so on — live, on every open.
There is no snapshot and no copy of the company's data checked into this repo.

## Access model

- **Roster-only.** Whoever opens the hosted app must already be logged into the
  company's founder360 panel — there is no separate signup/login inside the app itself.
  In production the app fetches a short-lived session token from same-origin
  `/_session`; in local dev (`f360 dev`) a localhost proxy injects the API key
  server-side and the browser never sees it either way.
- **The API key never reaches the browser and never belongs in this repo.** Don't read
  `F360_API_KEY` or `~/.founder360/credentials.json` from app code, don't hardcode a
  `f360_...` key anywhere, don't log one. `f360 deploy` refuses to publish a bundle that
  contains a string matching `f360_[0-9a-f]{48}` in any file, as a backstop — but don't
  rely on that catching a mistake for you.

## The SDK (`@founder360/sdk`)

Use `createAppClient` (not `createClient`, which takes a token directly and is for
scripts, not hosted apps). Create the client once, at module scope, and reuse it:

    import { createAppClient, F360Error } from "@founder360/sdk";
    const f = createAppClient();

`createAppClient()` auto-detects `localhost`/`127.0.0.1` (the `f360 dev` proxy, via
`/api`) vs. anywhere else (production, a `/_session` JWT) — you never branch on
environment yourself.

Methods:

- `f.inventory()` → `{ connectors: string[], mcp: string[] }` — what's connected for
  this company right now.
- `f.openapi()` → the company's OpenAPI document: every connected connector's commands
  as `/connector/command` paths, plus every allowlisted MCP tool as `/mcp/server/tool`.
  Each operation carries `x-ecom-write: boolean` — check it before calling anything you
  haven't seen before (see `src/App.tsx` for a worked example that only samples
  read-only commands this way).
- `f.call(connector, command, args?)` → `POST /connector/command`, vendor-shaped JSON
  back. `args` are the command's parameters under their snake_case names, exactly as
  `f.openapi()` lists them — an unknown parameter or a missing required one is rejected
  with a 400. Example (Shoper best sellers over the last 30 days; `date_from`/`date_to`
  are required):

      const day = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD
      const to = new Date();
      const from = new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
      const top = await f.call("shoper", "top-products", {
        date_from: day(from),
        date_to: day(to),
        top: 10,
      });

- `f.mcp(server, tool, args?)` → `POST /mcp/server/tool`. A tool-level failure comes
  back as a thrown `F360Error` with `code: "tool_error"` — catch it like any other
  `F360Error`, not as a `{ is_error: true }` object.
- `f.writes(limit?)` → the tenant's write audit log — useful for an "activity" panel.

Every method throws `F360Error { status, code, hint?, body? }` when the API answers with
an error; a network failure throws the browser's own `TypeError` instead, so handle both
(as `errorMessage` in `src/App.tsx` does). Retries are already built into the client —
you don't need your own retry loop around `f.call`:

- `429` → waits `Retry-After` (capped at 30s) and retries once.
- `503 token_refresh_pending` → the company's OAuth token is mid-refresh; the client
  waits 5s and retries, up to 12 times (up to ~1 minute total). **Keep showing a
  loading state for this** — it's retryable, not a hard failure.
- Anything else throws immediately. Render `err.hint ?? err.message` for the person
  using the app; don't leak `err.body` into the UI.

## Writes execute immediately — there is no approval step here

Unlike the WhatsApp/web agent (which pauses every write behind a human "Zatwierdź"
card), **a write made through this API executes right away** when `f.call(...)` or
`f.mcp(...)` returns 200. There is no approval gate in front of this API.

If your app can create, update, or delete anything in a connected system (an order, a
draft, a campaign setting, a CRM record, …), **add your own confirm step in the UI**
before making that call — a single button press is not enough for anything
irreversible. Read-only apps (dashboards, lookups, calculators) don't need this.

## Discovering what's available

- `f360 whoami` — from your terminal, prints the connectors/MCP servers the saved key
  can see.
- `f360 types` — writes `src/f360.d.ts` from the company's live OpenAPI document, so
  `f.call(...)`/`f.mcp(...)` args are type-checked while you build: a wrong or missing
  arg is a compile error, and anything not in the file stays untyped. Results are not
  typed (the API publishes no response schemas) — cast them yourself,
  `(await f.call(...)) as MyRow[]`, rather than `f.call<MyRow[]>(...)`, which turns the
  arg check off. Re-run it whenever the company connects something new.
- `f.openapi()` at runtime — the same document, if the app itself needs to introspect
  what it can call.

## Running and shipping

- `f360 dev` — starts a localhost proxy (port 4360) that holds the API key, then runs
  this project's `npm run dev` (Vite) against it. Open the URL Vite prints.
- `f360 deploy` — runs `npm run build`, validates the `dist/` bundle (limits below), and
  publishes it to `https://<id>.founder360.app`. Deploying again under the same slug
  is a new version at the same URL.
- **The app must build to static files — no server code.** Nothing here runs a Node
  server in production; `dist/` is served as-is from the host. Don't add API routes,
  SSR, or anything that needs a backend process — that's what the data API is for.
- **Keep Vite's default `base`.** `base: "/"` is already correct (the app is served at
  the root of its own subdomain) — don't set `base: "./"` or a custom base path in
  `vite.config.ts`.

## Limits and reserved paths

- Bundle: at most 200 files, at most 25 MB decoded, must contain `index.html` at the
  top level.
- Reserved top-level names the host router owns — never create a file or folder under
  these: `_lib`, `_auth`, `_session`, `_logout`.
- `slug` (in `f360.config.json`) must match `^[a-z0-9][a-z0-9-]{1,63}$`.

## The kit at `/_lib/` (same-origin, no build step needed)

Every hosted app — this one included — can load these directly with a `<script>` or
`<link>` tag, same-origin, no npm install:

- `/_lib/f360.css` — the shared design tokens/components (also used by hosted
  dashboards).
- `/_lib/chart.umd.js` — Chart.js, if you want charts without adding it to
  `package.json`.
- `/_lib/f360-sdk.v1.js` — the SDK as a global `window.F360` (`F360.connect()` returns
  an app client), meant for a *single-file* HTML app with no build step at all. This
  project already has `@founder360/sdk` as a real npm dependency, so prefer the
  `import` shown above; reach for the kit script only if you're adding a second,
  standalone HTML file outside this build.

Kit files are versioned by filename and never change in place — a future update ships
as `f360-sdk.v2.js`, etc., so a URL you hardcode today keeps working.
