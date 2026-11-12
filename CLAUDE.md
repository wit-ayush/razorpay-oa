@AGENTS.md

## Claude Code specifics
- Planning, building, review and debugging use the **Compound Engineering** plugin (`/ce-plan`, `/ce-work`, `/ce-code-review`, `/ce-debug`, `/ce-test-browser`). Its repo config is `.compound-engineering/config.yaml`, which writes markdown plans to `docs/plans/` and keeps reviews in-session.
- Project skills: `/scaffold-stack` (toolchain setup) and `/verify` (full quality gate with output you can paste).
- Constraints that override the plugin defaults in this repo:
  - **The human has authorized commits on `main`.** Don't create branches or worktrees, don't push, and don't open PRs.
  - `/ce-work` executes **only the unit(s) named in the prompt**, then stops for human review.
  - Don't run `/lfg` or other autonomous end-to-end pipelines here.
- A PreToolUse hook (`.claude/hooks/guard.mjs`) blocks the forbidden shortcuts listed in AGENTS.md, including for subagents. If it blocks you, fix the root cause. Don't work around it.
- Use `npm run dev` only in the background. Prefer `npm run e2e` or `/ce-test-browser` for browser checks.
