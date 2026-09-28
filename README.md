# founder360 app template

[founder360](https://founder360.ai) is the AI agent that runs on a company's own WhatsApp
number and orchestrates the e-commerce tools it already uses. This repo is the starting point
for a small web app built on the company's own data through `@founder360/sdk` — hosted at
`https://<id>.founder360.app` once deployed (`<id>` is a random 12-character code assigned on the first deploy and kept for every later version).

## Prerequisites

- A founder360 company account.
- A personal API key, minted from the panel's **Aplikacje** page.

## Quick start

```bash
npm i -g f360        # or: npx f360 <command>, with no global install
f360 login           # prompts for the API key, saves it to ~/.founder360/credentials.json
```

Then either:

```bash
git clone https://github.com/codeyourbrand/f360-template my-app
cd my-app
f360 init --slug my-app --title "My app"
```

or, starting from an empty directory instead of a clone:

```bash
mkdir my-app && cd my-app
npx f360 init --slug my-app --title "My app"
```

Then, from the project directory:

```bash
npm install
f360 types           # writes src/f360.d.ts: typed args for the company's connected commands
f360 dev             # local API proxy + `npm run dev`
f360 deploy          # builds and publishes to https://<id>.founder360.app
```

## For coding agents

`.claude/skills/founder360/SKILL.md` (identical to `AGENTS.md`) documents the SDK surface, the
retry semantics, that writes execute immediately with no approval step, and the app's limits.
Load it before writing or changing any code in a project scaffolded from this template.

## License

MIT — see `LICENSE`.
