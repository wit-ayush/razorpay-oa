#!/usr/bin/env node
// Generic frontend toolchain setup. It contains NO feature code.
// Vite + React + TS (strict) · Vitest + RTL + jsdom · Playwright · oxlint (strict).
// Usage (from repo root): node .claude/skills/scaffold-stack/setup.mjs

import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const root = process.cwd()
const TMP = '.scaffold-tmp'

const run = (cmd) => {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: root })
}
const write = (rel, content) => {
  const abs = join(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
  console.log(`wrote ${rel}`)
}
const edit = (rel, from, to) => {
  const abs = join(root, rel)
  const src = readFileSync(abs, 'utf8')
  if (!src.includes(from)) throw new Error(`setup: expected text not found in ${rel}: ${from}`)
  writeFileSync(abs, src.replace(from, to))
  console.log(`edited ${rel}`)
}

// ---- preflight -------------------------------------------------------------
const [maj, min] = process.versions.node.split('.').map(Number)
if (maj < 22 || (maj === 22 && min < 12)) {
  console.error(`Node ${process.versions.node} is too old. Vitest/jsdom need Node >= 22.12. Upgrade Node first.`)
  process.exit(1)
}
if (existsSync(join(root, 'package.json'))) {
  console.error('package.json already exists, refusing to re-scaffold over an existing project.')
  process.exit(1)
}

// ---- 1. official Vite react-ts template, moved up without clobbering -------
rmSync(join(root, TMP), { recursive: true, force: true })
run(`npm create vite@latest ${TMP} -- --template react-ts --no-interactive`)
for (const name of readdirSync(join(root, TMP))) {
  if (name === 'README.md') continue // we write our own README with real commands
  if (name === '.gitignore' && existsSync(join(root, name))) {
    appendFileSync(join(root, name), '\n' + readFileSync(join(root, TMP, name), 'utf8'))
    console.log('merged .gitignore')
    continue
  }
  if (existsSync(join(root, name))) {
    console.log(`kept existing ${name}`)
    continue
  }
  cpSync(join(root, TMP, name), join(root, name), { recursive: true })
}
rmSync(join(root, TMP), { recursive: true, force: true })

// ---- 2. strip demo boilerplate --------------------------------------------
for (const p of ['src/App.css', 'src/assets', 'public/icons.svg']) rmSync(join(root, p), { recursive: true, force: true })

write(
  'src/App.tsx',
  `function App() {
  return (
    <main>
      <h1>${basename(root)}</h1>
    </main>
  )
}

export default App
`,
)
write(
  'src/main.tsx',
  `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found in index.html')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`,
)
write(
  'src/index.css',
  `*, *::before, *::after { box-sizing: border-box; }
:root {
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.5;
  color-scheme: light dark;
}
body { margin: 0; min-width: 320px; }
main { max-width: 960px; margin: 0 auto; padding: 1rem; }
:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
`,
)

// ---- 3. dependencies -------------------------------------------------------
run('npm install --no-audit --no-fund')
run(
  'npm install -D --no-audit --no-fund vitest jsdom @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom @playwright/test',
)
run('npx playwright install chromium')

// ---- 4. config -------------------------------------------------------------
write(
  'vite.config.ts',
  `/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
})
`,
)
write(
  'src/test/setup.ts',
  `import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
`,
)
write(
  'playwright.config.ts',
  `import { defineConfig, devices } from '@playwright/test'

const PORT = 5173

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: 'list',
  use: { baseURL: \`http://localhost:\${PORT}\`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: \`npm run dev -- --port \${PORT} --strictPort\`,
    url: \`http://localhost:\${PORT}\`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
`,
)
write(
  '.oxlintrc.json',
  JSON.stringify(
    {
      $schema: './node_modules/oxlint/configuration_schema.json',
      plugins: ['react', 'typescript', 'oxc', 'jsx-a11y', 'vitest'],
      rules: {
        'react/rules-of-hooks': 'error',
        'react/exhaustive-deps': 'warn',
        'react/only-export-components': ['warn', { allowConstantExport: true }],
        'typescript/no-explicit-any': 'error',
        'typescript/ban-ts-comment': 'error',
        'typescript/no-non-null-assertion': 'warn',
        'no-empty': ['error', { allowEmptyCatch: false }],
        'vitest/no-focused-tests': 'error',
        'vitest/no-disabled-tests': 'error',
        'jsx-a11y/alt-text': 'error',
        'jsx-a11y/label-has-associated-control': 'error',
        'jsx-a11y/click-events-have-key-events': 'error',
        'jsx-a11y/no-static-element-interactions': 'error',
      },
    },
    null,
    2,
  ) + '\n',
)
edit('tsconfig.app.json', '"noFallthroughCasesInSwitch": true', '"noFallthroughCasesInSwitch": true,\n    "strict": true')
edit('tsconfig.node.json', '"noFallthroughCasesInSwitch": true', '"noFallthroughCasesInSwitch": true,\n    "strict": true')
edit('tsconfig.node.json', '"include": ["vite.config.ts"]', '"include": ["vite.config.ts", "playwright.config.ts", "e2e"]')

const pkgPath = join(root, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
Object.assign(pkg.scripts, {
  lint: 'oxlint --deny-warnings',
  typecheck: 'tsc -b',
  test: 'vitest run',
  'test:watch': 'vitest',
  e2e: 'playwright test',
  check: 'npm run lint && npm run typecheck && npm run test && npm run build && npm run e2e',
})
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log('edited package.json scripts')

appendFileSync(join(root, '.gitignore'), '\n# test artifacts\ntest-results\nplaywright-report\nblob-report\ncoverage\n.scaffold-tmp\n')

// ---- 5. toolchain smoke tests (prove runners work; replace with behaviour tests) ----
write(
  'src/App.test.tsx',
  `import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App'

// Toolchain smoke test: proves Vitest + RTL + jsdom are wired. Replace with behaviour tests.
it('shows the app heading', () => {
  render(<App />)
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
})
`,
)
write(
  'e2e/smoke.spec.ts',
  `import { expect, test } from '@playwright/test'

// Toolchain smoke test: proves Playwright + dev server are wired. Replace with the real happy-path E2E.
test('app loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
`,
)

console.log('\nToolchain ready. Next: npm run lint && npm run typecheck && npm run test && npm run build && npm run e2e')
