# CLAUDE.md

Guidance for Claude Code in this repository.

## Publishing (Buddy Dive Games site)

This game is published only on the studio site: https://buddy-dive-games.vercel.app/it-sounds/. This repo has no Vercel project of its own: don't run `vercel link` or `vercel deploy` here and don't add a `vercel.json`.

- **How it goes live:** a push to `main` runs `.github/workflows/buddy-games-studio.yml`, which calls the site's Vercel deploy hook (repo secret `BUDDY_GAMES_DEPLOY_HOOK`). The site (repo `salvofe/salvofe-games`, folder `C:\Users\salva\Desktop\Progetti\salvofe-games`) clones this repo, runs `npm ci` and `npm run build` and serves `out` under `/it-sounds/`. It is online 2-3 minutes after the push. Other branches are not published: try them locally.
- **A failed build blocks the whole site** (the previous version stays online). Run the same build locally before pushing to `main`.
- **Sub-path:** `next.config.ts` has `output: 'export'`, `basePath` (from `BASE_PATH`, default `/it-sounds`, see `lib/basePath.ts`) and `trailingSlash: true`. Keep them. The game is a static export: no API routes, server actions, `cookies()`/`headers()` or other server features (the build fails). The AI commentary uses a fixed line since the API route was removed; real commentary would need a function in the site with rate limiting.
- **Fonts are self-hosted** (`app/fonts.css`, files from the pinned `@fontsource/*` packages, latin + latin-ext, referenced as `url('~@fontsource/...')` so Next copies them under the basePath): never link Google Fonts again, it sends every player's IP to Google.
- Saves live in the browser storage of the site address: all games share it, so keep storage keys prefixed with the game name.
- To change how this game is built (commands, output folder, env vars, path), edit its entry in `games.json` in the site repo, not this repo.

## Demo edition and full game

The site sells the full game and serves a free demo. Both come from this repo, chosen at build time:

- **Edition:** `NEXT_PUBLIC_EDITION=demo` builds the demo; any other value (or none) builds the full game, unchanged. Logic in `lib/edition.ts` (`editionFrom`, `playableMode`, `ownsFullGame`, `askOwnership`); `next.config.ts` always inlines the value.
- **The demo** plays only the Short mode, with all 8 genres. Classic is shown on the setup screen but locked, with "Unlock the full game" → `/en/unlock/?game=it-sounds` (a site page, root-absolute). At the end of a Short game a box invites to try Classic in the full game. A "DEMO" label sits on the tutorial and setup screens. The store (`store/gameStore.ts`) turns any Classic request into Short and never advances a non-Short state, so no path (UI, `?e2e=1` hook, stale state) plays Classic.
- **Owners:** at startup the demo asks `/api/io` (same origin, with cookies; any error = not an owner, `store/ownership.ts`). Signed in with `it-sounds` or `*` in `games` → the links read "Continue in the full game" → `/it-sounds/completo/`. The full edition shows no demo UI and never calls `/api/io`.
- **Base path:** `BASE_PATH` sets Next's `basePath` (default `/it-sounds`, so a plain `npm run build` is the same as before). The site serves the demo at `/it-sounds/` and the full build at `/it-sounds/completo/`, built with `BASE_PATH=/it-sounds/completo`. Next bakes it into every URL, so never hard-code `/it-sounds` in asset or page links; the only absolute links are the site pages above.
- **Try both locally:** `BASE_PATH=/it-sounds/completo npm run build` and `NEXT_PUBLIC_EDITION=demo npm run build`, then serve each `out/` at its path (e.g. copy into `site/it-sounds/completo/` and `site/it-sounds/`, `python -m http.server --directory site`). `npm run check:board` serves `out/` itself under `BASE_PATH` (default `/it-sounds`) and needs a full build (it starts Classic games).
- **Site config** (`games.json` in the site repo, entry `it-sounds`; the site merges `source.env` then `source.demo.env` for the demo build, and copies the full build to `<path>/completo/`):

```json
"access": "locked",
"source": {
  "path": "it-sounds",
  "repo": "salvofe/it-sounds",
  "branch": "main",
  "build": ["npm ci", "npm run build"],
  "env": { "BASE_PATH": "/it-sounds/completo" },
  "out": "out",
  "demo": {
    "build": ["npm run build"],
    "env": { "NEXT_PUBLIC_EDITION": "demo", "BASE_PATH": "/it-sounds" },
    "out": "out"
  }
}
```
