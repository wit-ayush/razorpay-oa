---
title: Payment Links manager
type: feat
status: active
date: 2026-11-12
---

# Payment Links manager: plan

## Brief
Build a Payment Links manager for a merchant dashboard (React + TypeScript):
- A create form with these fields: amount (required, > 0, max 2 decimals, max ₹5,00,000); description (required, max 100 chars); customer email OR phone (at least one, format validated); expiry (optional, must be in the future).
- A list showing amount, description, customer, status (Active / Paid / Expired) and created time. Links whose expiry has passed show Expired.
- A filter by status: All / Active / Paid / Expired.
- In-memory or mocked data, no backend. Empty, error and validation states. Keyboard-accessible and usable at mobile width.

## Clarifying questions → assumptions
| # | Question | Assumption |
|---|---|---|
| Q1 | Currency, minimum, and is the cap inclusive? | INR only. Valid range is ₹0.01 to ₹5,00,000.00 inclusive, at most 2 decimals, stored as integer paise |
| Q2 | Is description length counted after trimming? | Trimmed; whitespace-only is invalid |
| Q3 | Phone format? Can both email and phone be given? | Indian 10-digit mobile starting 6–9, optional `+91`. If both are given, both must be valid |
| Q4 | Expiry: date or date and time? Which timezone? | Local date and time, strictly later than now at submit. Empty means it never expires |
| Q5 | Should status update live? | Yes. Status is derived from the current time and rechecked every 30s |
| Q6 | How does a link become Paid? | Seed data, plus a "Mark as paid" action on Active links. Paid takes priority over Expired |
| Q7 | Persist across refresh? | No. In-memory mock API |
| Q8 | What errors can happen with no backend? | Mock API failure injection: load error shows Retry; create error keeps the form values |
| Q9 | Sort order, pagination? | Newest first, no pagination |
| Q10 | Edit or delete links? | Out of scope |
| Q11 | When to validate? | On blur and on submit; focus the first invalid field |
| Q12 | Mobile layout? | Cards under 640px, table above |

## Acceptance criteria
**Create form**
- **AC-1 Amount:** required. Accepts digits with an optional `.` and up to 2 decimals. Must be > 0 and ≤ 500000 (inclusive). Rejects `0`, `0.001`, `500000.01`, `abc`, `1,000` and empty input, each with a specific message.
- **AC-2 Description:** required after trimming, at most 100 characters (100 is OK, 101 fails). Shows a live character counter.
- **AC-3 Customer:** at least one of email or phone. Email must be in a valid format. Phone must be 10 digits starting 6–9 with an optional `+91`. If both are filled in, both must be valid. Shows a clear error when neither is given.
- **AC-4 Expiry:** optional. If set, it must be later than now (a past time or exactly now fails).
- **AC-5 Submit:** an invalid submit shows all errors and focuses the first invalid field. A valid submit creates the link, announces success through `aria-live`, resets the form, and disables the button while pending. On API failure, an error message is shown and the input is kept.

**List and status**
- **AC-6 List:** shows the amount (₹ en-IN format), description, customer (email and/or phone), status badge and created time. Newest first.
- **AC-7 Status:** derived as follows: paid → Paid; expiry ≤ now → Expired; otherwise Active. Paid takes priority over Expired. An open page flips Active → Expired without a reload (30s tick).
- **AC-8 Mark as paid:** available only on Active links, and changes the status to Paid.
- **AC-9 Filter:** All / Active / Paid / Expired tabs with counts. The list shows only matching links. The tabs are keyboard operable.

**States, accessibility and responsiveness**
- **AC-10 States:** a loading indicator, an error with a Retry button, an empty state with no links, and a per-filter empty state ("No expired links").
- **AC-11 Accessibility:** every input has a label; errors are linked with `aria-describedby`; everything works with the keyboard; focus is visible.
- **AC-12 Mobile:** usable at 375px with no horizontal scroll (cards layout).

**Out of scope:** editing or deleting links, persistence, real payments, pagination, currencies other than INR.

## Definition of Done
A unit is done only when **all** of the following are true:
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` and `npm run e2e` all pass, with the real output shown.
- Every AC has at least one behaviour test covering the happy path, the boundaries and invalid input.
- There's no `any`, `@ts-ignore`, lint-disable comment, empty `catch` or skipped test. No test or validation was deleted to get a pass. (A guard hook enforces this.)
- I've read the diff and reviewed it with `/ce-code-review`, and the app has been checked in a browser (keyboard and 375px).
- It's committed with a Conventional Commit that references the ACs, and pushed.

## Plan: 5 agent loops (units)
| Unit | Scope | ACs | Approach | Commit / checkpoint |
|---|---|---|---|---|
| U1 | Toolchain (Vite, React, TS, Vitest, RTL, Playwright, oxlint) | - | Done before the brief | `chore: scaffold…` ✅ |
| U2 | `types.ts` + pure `lib/`: `parseAmountToPaise`, `validateLinkForm(input, now)`, `getStatus(link, now)`, `filterLinks`, `formatINR` | AC-1–4, AC-7, AC-9 (logic) | **Tests first** (boundary tables), then implement | `feat: validation and status logic with tests` |
| U3 | Mock API (`listLinks`, `createLink`, `markPaid`, latency, failure injection, seed) + `usePaymentLinks` hook (async discriminated union, 30s clock) | AC-5 (API), AC-7 live, AC-8, AC-10 | Tests first for the API and hook (fake timers) | `feat: in-memory payment links api and hook` |
| U4 | UI: `CreateLinkForm`, `LinksList` (table/cards), `StatusFilter`, `StatusBadge`, wired in `App` | AC-5, 6, 8–12 | Feature first, then RTL tests with `user-event` for each AC | `feat: payment links ui with rtl tests` |
| U5 | Playwright E2E (create → Active → filter; validation error path), then `/verify` gate | All, end to end | Replace the smoke tests | `test: e2e create and filter flow` → push at the end of Section 3 |

**Why this order:** the business rules (money, validation, status) carry the risk, so they go first as pure, fully tested functions with `now` injected, where the tests are cheap and deterministic. Then the data layer, then a thin UI on top, then the E2E for the end-to-end proof. Each unit is one concern touching about 5 files or fewer.
**Checkpoints:** after each unit I read the diff, run `/ce-code-review`, run the checks, commit, and push. I also commit and push at the end of every OA section.

---

## Change note (2026-11-12): partial payments + persistence

**New requirement:** "Allow partial payments" with a "Minimum first payment"; each link tracks the amount paid; a "Record payment" action; statuses Active / Partially paid / Paid / Expired; list shows paid / due; filter gains "Partially paid"; links survive a reload.

**Assumptions (my decisions on the gaps)**
- With partial payments OFF, a recorded payment must equal the full amount due.
- With partial payments ON, the first payment must be ≥ the minimum first payment unless it clears the full amount. Later payments can be any amount > 0 and ≤ due.
- Paid is derived (`amountPaidPaise === amountPaise`), never stored as a flag.
- Persistence: localStorage behind the existing API interface, validated on read. Corrupt or invalid data falls back to seed data.
- "Mark as paid" is replaced by "Record payment". Paying the full due amount gives the same result.

**New / changed acceptance criteria**
- **AC-13 Partial option:** the "Allow partial payments" checkbox reveals "Minimum first payment (₹)": required when ticked, same money rules as amount (> 0, ≤ 2 decimals), and **≤ amount**. Ignored when unticked.
- **AC-14 Record payment:** only on Active and Partially paid links. The amount must be > 0, ≤ 2 decimals and **≤ amount due**. Partial rules as in the assumptions. Clear inline errors.
- **AC-15 Status precedence (replaces AC-7):** paid in full → **Paid** (never expires); else expiry ≤ now → **Expired** (beats Active and Partially paid); else paid > 0 → **Partially paid**; else **Active**.
- **AC-16 Money:** all totals are integer paise. ₹0.10 + ₹0.20 on a ₹0.30 link gives exactly Paid with ₹0.00 due.
- **AC-17 List & filter:** each link shows "Paid ₹x / Due ₹y". The filter gains "Partially paid (n)" (replaces part of AC-8 and AC-9).
- **AC-18 Persistence:** links and payments survive a page reload. Corrupt storage doesn't crash the app.

**New units**
| Unit | Scope | ACs |
|---|---|---|
| U6 | Types, status precedence, `validateRecordPayment`, min-first-payment validation. **Tests first** | 13–16 |
| U7 | API `recordPayment` + localStorage persistence (validated read, fallback) + tests | 14, 18 |
| U8 | UI: checkbox + min field, per-link Record payment, paid/due, new filter + RTL tests | 13, 14, 17 |
| U9 | E2E: partial payment → Partially paid → reload → pay the rest → Paid; full gate | all |
