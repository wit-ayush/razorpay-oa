---
name: scaffold-stack
description: Set up the standard frontend toolchain in the current (empty, rules-only) repo. Vite + React + TypeScript strict, Vitest + React Testing Library + jsdom, Playwright, oxlint with strict rules. Toolchain only, no feature code.
disable-model-invocation: true
---

# Scaffold the toolchain

This only sets up tooling. It doesn't create any feature code.

1. Confirm the repo root has no `package.json` (the script refuses to overwrite), and check `node --version` is 22.12 or newer.
2. Run: `node .claude/skills/scaffold-stack/setup.mjs`
   It does the following:
   - scaffolds the official `create-vite` `react-ts` template into a temp folder and moves it to the root without overwriting existing files
   - strips the demo boilerplate down to a minimal `<main><h1>` App
   - installs Vitest, RTL, user-event, jest-dom, jsdom and @playwright/test, plus the Playwright Chromium browser
   - writes `vite.config.ts` (with the Vitest config), `src/test/setup.ts`, `playwright.config.ts`, a strict `.oxlintrc.json` and strict tsconfigs
   - adds the npm scripts `typecheck`, `test`, `test:watch`, `e2e` and `check`
   - adds toolchain **smoke tests**, which only prove the runners work and must be replaced by behaviour tests
3. Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` and `npm run e2e`, and paste the real output.
4. Report the installed versions (`npm ls --depth=0`) and suggest the commit `chore: scaffold vite react-ts toolchain with vitest, rtl, playwright`.
5. Stop for review.
