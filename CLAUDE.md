# CLAUDE.md

Guidance for Claude Code in this repository.

## Publishing (Buddy Dive Games site)

This game is published only on the studio site: https://buddy-dive-games.vercel.app/it-sounds/. This repo has no Vercel project of its own: don't run `vercel link` or `vercel deploy` here and don't add a `vercel.json`.

- **How it goes live:** a push to `main` runs `.github/workflows/buddy-games-studio.yml`, which calls the site's Vercel deploy hook (repo secret `BUDDY_GAMES_DEPLOY_HOOK`). The site (repo `salvofe/salvofe-games`, folder `C:\Users\salva\Desktop\Progetti\salvofe-games`) clones this repo, runs `npm ci` and `npm run build` and serves `out` under `/it-sounds/`. It is online 2-3 minutes after the push. Other branches are not published: try them locally.
- **A failed build blocks the whole site** (the previous version stays online). Run the same build locally before pushing to `main`.
- **Sub-path:** `next.config.ts` has `output: 'export'`, `basePath: '/it-sounds'` and `trailingSlash: true`. Keep them. The game is a static export: no API routes, server actions, `cookies()`/`headers()` or other server features (the build fails). The AI commentary uses a fixed line since the API route was removed; real commentary would need a function in the site with rate limiting.
- Saves live in the browser storage of the site address: all games share it, so keep storage keys prefixed with the game name.
- To change how this game is built (commands, output folder, env vars, path), edit its entry in `games.json` in the site repo, not this repo.
