---
name: verify
description: Run the full quality gate (lint, typecheck, unit tests, build, E2E) plus a real-browser check, and report the raw output with an honest pass/fail summary ready to paste into a submission. Use before every section submission.
disable-model-invocation: true
---

# Verify (quality gate)

Run each command **separately**, in this order, and capture its real output. Don't stop at the first failure: run them all so the human sees the full picture.

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`
5. `npm run e2e`

Then do a **browser check** with the `/ce-test-browser current` skill (Playwright MCP). Exercise the acceptance criteria from the newest plan in `docs/plans/`: the main flow, keyboard-only use, a 375px viewport, the empty and error states, and console errors.

Also scan for forbidden shortcuts and report any hits:
`git grep -nE "@ts-(ignore|nocheck|expect-error)|(eslint|oxlint)-disable|\bas any\b|:\s*any\b|\.(skip|only)\(" -- src e2e`

If any check fails, suggest `/ce-debug <failing command + error>`. Don't silence the failure.

## Report format
```
GATE RESULT: PASS | FAIL
lint       ✅/❌  <last meaningful line>
typecheck  ✅/❌  ...
unit       ✅/❌  Tests: X passed (Y files)
build      ✅/❌  ...
e2e        ✅/❌  X passed
browser    ✅/❌  <ce-test-browser summary>
shortcuts  none | <list>
```
After that, include a fenced block with the **raw tail output** of each command, ready to paste into a submission.
Then add an **"Untested / not trusted yet"** section listing the gaps you know about. Never report PASS for something you didn't actually run.
