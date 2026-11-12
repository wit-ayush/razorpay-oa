import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LinksList } from '../components/LinksList'
import type { PaymentLink } from '../types'
import { useNow } from './useNow'

const START = new Date('2026-11-12T10:00:00.000Z')

describe('live expiry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('useNow ticks every interval', () => {
    const { result } = renderHook(() => useNow(30_000))
    expect(result.current.toISOString()).toBe(START.toISOString())

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(result.current.toISOString()).toBe('2026-11-12T10:00:30.000Z')
  })

  it('an open list flips a link from Active to Expired once its expiry passes', () => {
    const link: PaymentLink = {
      id: 'l1',
      amountPaise: 1000,
      amountPaidPaise: 0,
      allowPartial: false,
      description: 'Short-lived link',
      customer: { email: 'a@b.co' },
      expiresAt: '2026-11-12T10:00:10.000Z',
      createdAt: START.toISOString(),
    }
    function Harness() {
      return <LinksList links={[link]} now={useNow(30_000)} onRecordPayment={async () => {}} />
    }
    render(<Harness />)
    expect(screen.getByText('Active')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByText('Expired')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record payment' })).not.toBeInTheDocument()
  })
})
