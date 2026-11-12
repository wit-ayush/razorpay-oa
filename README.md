# Payment Links manager

A merchant-dashboard feature for creating payment links and listing them with an Active / Paid / Expired status filter. Built with Vite, React 19 and TypeScript (strict). Data comes from an in-memory mock API.

Requires Node ≥ 22.12.

| Task | Command |
|---|---|
| Install | `npm install` then `npx playwright install chromium` |
| Run (dev) | `npm run dev` → http://localhost:5173 (add `?fail=1` to see the load-error state) |
| Unit tests | `npm run test` |
| E2E | `npm run e2e` |
| All checks | `npm run check` (lint, typecheck, test, build, e2e) |

- Plan, acceptance criteria and definition of done: [`docs/plans/`](docs/plans/)
- Agent rules: [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md)
- Business logic (pure, unit-tested): `src/features/payment-links/lib/`
