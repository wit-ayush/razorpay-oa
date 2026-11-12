#!/usr/bin/env node
// PreToolUse guard: blocks edits that "make it green" by cheating instead of fixing.
// Generic quality gate. It enforces the Definition of Done in AGENTS.md.
// Exit code 2 = block the tool call; stderr is shown to the agent as the reason.

import { readFileSync } from 'node:fs'

let input
try {
  input = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0) // malformed hook input: never block on our own failure
}

const tool = input.tool_name ?? ''
const ti = input.tool_input ?? {}
const filePath = String(ti.file_path ?? ti.notebook_path ?? '').replace(/\\/g, '/')

if (!filePath || filePath.includes('/node_modules/') || filePath.includes('/.claude/')) process.exit(0)

// Collect only the NEW text being introduced.
let added = []
if (tool === 'Write') added = [ti.content ?? '']
else if (tool === 'Edit') added = [ti.new_string ?? '']
else if (tool === 'MultiEdit') added = (ti.edits ?? []).map((e) => e.new_string ?? '')
else process.exit(0)
const text = added.join('\n')

const isCode = /\.(m|c)?[jt]sx?$/.test(filePath)
const isLintConfig = /(^|\/)(\.oxlintrc\.json|eslint\.config\.[cm]?[jt]s|\.eslintrc(\.\w+)?)$/.test(filePath)
const isTsConfig = /(^|\/)tsconfig(\.[\w-]+)?\.json$/.test(filePath)

const problems = []
const check = (re, why) => {
  if (re.test(text)) problems.push(why)
}

if (isCode) {
  check(/@ts-(ignore|nocheck|expect-error)/, 'TypeScript suppression comment (@ts-ignore / @ts-nocheck / @ts-expect-error)')
  check(/(eslint|oxlint)-disable/, 'lint suppression comment (eslint-disable / oxlint-disable)')
  check(/(:\s*any\b|\bas\s+any\b|<any>|any\[\]|Array<any>|Record<[^>]*\bany\b)/, 'explicit `any` type')
  check(/catch\s*(\([^)]*\))?\s*\{\s*\}/, 'empty catch block (swallowed error)')
  check(/\.catch\(\s*\(\s*\)\s*=>\s*(\{\s*\}|null|undefined)\s*\)/, 'swallowed promise rejection (.catch(() => {}))')
  check(/\b(it|test|describe)\.(skip|only|todo)\s*\(|\b(xit|xdescribe|fit|fdescribe)\s*\(/, 'skipped or focused test (.skip / .only / xit)')
  check(/expect\(\s*(true|false|1|0)\s*\)\.(toBe|toEqual)\(\s*(true|false|1|0)\s*\)/, 'hollow assertion (expect(true).toBe(true))')
}
if (isLintConfig) {
  check(/["']off["']|:\s*0\b|["']allow["']/, 'turning a lint rule off')
}
if (isTsConfig) {
  check(/"strict"\s*:\s*false|"noImplicitAny"\s*:\s*false|"skipDefaultLibCheck"|"checkJs"\s*:\s*false/, 'loosening TypeScript strictness')
}

if (problems.length === 0) process.exit(0)

process.stderr.write(
  `BLOCKED by DoD guard (.claude/hooks/guard.mjs) in ${filePath}:\n` +
    problems.map((p) => `  - ${p}`).join('\n') +
    `\nThis violates AGENTS.md → Definition of Done. Fix the root cause instead of suppressing it.` +
    `\nIf you believe this is genuinely necessary, STOP and explain why to the human. Do not work around this hook.\n`,
)
process.exit(2)
