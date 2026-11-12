# AGENTS.md: Project rules for coding agents

These rules apply to every task in this repo. The **current task** (brief, clarifying questions, acceptance criteria `AC-n`, implementation units `U-n`) lives in the newest plan in `docs/plans/`. Read it before doing anything.

## Workflow (Compound Engineering plugin by EveryInc, declared in `.claude/settings.json`)
| Step | Command | Notes |
|---|---|---|
| Plan | `/ce-plan` | Writes `docs/plans/<date>-…-plan.md`. Plans only, never code. The human edits the plan before any build. |
| Scaffold | `/scaffold-stack` | Project skill. Toolchain only. |
| Build | `/ce-work <plan> <unit>` | **One unit per run**, then stop for human review. Commits on `main` are allowed; **no branches, no PRs, no pushes** (the human pushes). |
| Review | `/ce-code-review` (`quick` when short on time) | Report-only. The human decides which findings to fix. |
| Failing check | `/ce-debug` | Root cause first, no shotgun fixes. |
| Gate | `/verify` | Project skill. Runs the full Definition of Done and a browser check. |
| Change | `/ce-plan <plan path> <new requirement>` | Update the plan, then the project rules, then `/ce-work` the new units. |

## Roles
- The human is the **director**: they own scope, decisions and the final review.
- You are the **executor**: small, reviewable changes that are verified with real command output.
- If something is ambiguous, **ask**. Don't guess the requirements or invent an API.

## Stack
- Vite + React (function components, hooks) + TypeScript in `strict` mode
- Unit and component tests: Vitest + React Testing Library + jsdom + `@testing-library/user-event`
- E2E: Playwright (Chromium), specs in `e2e/`
- Lint: oxlint (`npm run lint`). Types: `npm run typecheck` (`tsc -b`)
- **No new runtime dependencies without the human's approval.** Prefer the platform and React itself.

## Folder layout
```
src/
  features/<feature>/
    components/     # React components (presentational where possible)
    hooks/          # stateful logic wiring (useX)
    lib/            # PURE functions: validation, reducers, selectors, formatting (no React)
    api/            # data access / mocked API (async, typed)
    types.ts        # domain types for the feature
  components/       # shared, generic UI only
  test/setup.ts     # test setup (jest-dom matchers, cleanup)
e2e/                # Playwright specs
```
- Tests sit next to the code as `*.test.ts` / `*.test.tsx`.
- Business rules go in `lib/` as pure functions, so they can be unit-tested without rendering.

## Conventions
- Named exports (except `App`). Components are `PascalCase.tsx`, hooks are `useCamelCase.ts`, and everything else is `camelCase.ts`.
- Model domain state with explicit types. Use **discriminated unions** for async state (`idle | loading | success | error`) instead of loose booleans.
- Use `useState`/`useReducer` locally and lift state only when two siblings need it. Don't add a global store unless the plan says so.
- Validate at the boundary (form input, API response). Keep internal code typed and trusting.
- Every async UI handles **loading, empty and error** states, and the error state must be visible to the user.
- Keep components small and avoid premature abstraction: three similar lines beat a speculative helper.

## Accessibility (required)
- Semantic HTML first (`button`, `label`, `form`, `ul/li`, `main`, headings in order).
- Every input has a visible `<label>`. Errors are linked with `aria-describedby` and announced through `role="alert"` or `aria-live`.
- Everything must work with the keyboard and keep a visible focus. Don't put `onClick` on a `div`.
- Layout must work at a 375px width.

## Testing rules
- Test **behaviour**, not implementation: what the user sees and does, and what a function returns for a given input.
- Query by role, label or text (`getByRole`, `getByLabelText`). Use `data-testid` only as a last resort.
- For every rule in the acceptance criteria, cover the happy path, **boundary values, invalid input, the empty state and the error path**.
- Mock only at the network or time boundary (API module, timers). **Never mock the unit under test.**
- Not allowed: snapshot-only tests, "renders without crashing" tests, assertions on mocks of the code being tested, or tests with no assertion.
- Pure logic in `lib/` gets direct unit tests. Components get RTL tests with `user-event`.
- At least **one Playwright E2E** for the main happy path of the brief, asserting on visible outcomes.

## Definition of Done (every loop)
A change is done only when **all** of these pass and you have shown their **real output**:
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`
5. `npm run e2e` (at least at the end of each section, and whenever the UI flow changes)

**Forbidden shortcuts** (a hook blocks most of them, and they're never acceptable):
`any`, `as any`, `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, `eslint-disable` / `oxlint-disable`, empty `catch`, `.skip` / `.only` / `xit`, or deleting or weakening a test or validation to make a check pass, or loosening `tsconfig` or lint rules.
If a check fails, **fix the root cause** or stop and explain why you can't.

## Working agreement
1. **Plan first.** Before coding, restate the goal and list the files you'll touch, then wait for approval when asked.
2. **Small loops.** One loop covers one concern (for example "validation logic + tests"), touches about 5 files or fewer, and ends with the DoD checks.
3. **Tests with or before code** for anything in `lib/`.
4. **Stay in scope.** Don't do unrequested refactors, renames, styling overhauls or "while I'm here" changes. Mention them instead.
5. **Report honestly.** Say what you ran and paste the actual output. If you didn't run something, say so. Never claim a check passed unless you saw it pass.
6. **Don't guess.** If you're unsure an API or package exists, check `node_modules`, the types or the docs, or ask.
7. **Disagree when it matters.** If the human's instruction conflicts with the spec or these rules, say so before complying.
8. **Commits**: one Conventional Commit per unit on `main` (`feat:`, `test:`, `fix:`, `refactor:`, `docs:`, `chore:`), referencing AC IDs. The human reviews the diff and pushes. Never push, branch or open PRs.

## Project-specific rules
> Filled in for the current brief before any code, and updated when requirements change. These rules **override** the generic ones above where they conflict.

Current brief: **Payment Links manager**. Feature folder: `src/features/payment-links/`.

- **Domain:** `PaymentLink = { id, amountPaise: number, description: string, customer: { email?: string; phone?: string }, expiresAt?: string (ISO), paidAt?: string (ISO), createdAt: string (ISO) }`. `LinkStatus = 'active' | 'paid' | 'expired'`. `StatusFilter = 'all' | LinkStatus`.
- **Data source & mocking:** an in-memory mock API in `api/paymentLinksApi.ts` (`listLinks`, `createLink`, `markPaid`), async, with configurable latency and failure injection for error states. No persistence across reloads. Seed data includes Active, Paid and Expired links.
- **Domain rules:**
  - Money is **integer paise** everywhere. Parse the input string to paise with string arithmetic and never use float maths. Valid range: 1 paise up to 5,00,00,000 paise (₹5,00,000) inclusive, at most 2 decimals, digits and one optional `.` only. Display with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
  - Description is trimmed, required, and at most 100 characters after trimming.
  - Contact: at least one of email or phone. Phone is an Indian mobile number: 10 digits starting 6–9, with an optional `+91` prefix. If both are given, both must be valid.
  - Expiry is optional, a local date and time, and must be strictly later than `now` at submit.
  - **Status is derived, never stored**: `getStatus(link, now)`. If paid → `paid` (paid wins over expired). Else if `expiresAt <= now` → `expired`. Else `active`. Only active links can be marked paid.
  - Validation and status functions take `now` as a parameter. No hidden `Date.now()` in `lib/`.
- **UI specifics:**
  - Validate on blur and on submit. On a failed submit, focus the first invalid field. Errors are linked with `aria-describedby`.
  - Success is announced through `aria-live`. The form resets after a successful create, and the submit button is disabled while a request is pending.
  - The list is sorted newest first. Filter tabs show counts. A clock tick every 30s re-derives statuses.
  - Table at ≥640px, stacked cards below. Each status filter has its own empty state, and loading has an error-with-retry state.
- **Testing specifics:**
  - Pure-function tests for amount parsing (boundaries: 0, 0.01, 0.001, 500000, 500000.01, "1.", "abc", "1,000"), the description limit (100 vs 101, whitespace-only), email and phone formats, expiry (past, now, future) and `getStatus` (paid+expired, expiry == now).
  - Use `vi.useFakeTimers()` / `vi.setSystemTime` for anything time-based.
  - The E2E covers create → appears as Active → filter.

## When requirements change
Update the plan in `docs/plans/` first (acceptance criteria, units and a dated change note), and update *Project-specific rules* above if conventions change. Then add failing tests for the new rule and its edge cases, then implement. Extend the existing code; **don't start over**.
