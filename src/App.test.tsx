import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App'

// Toolchain smoke test: proves Vitest + RTL + jsdom are wired. Replace with behaviour tests.
it('shows the app heading', () => {
  render(<App />)
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
})
