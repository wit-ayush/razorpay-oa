import type { LinkStatus, PaymentLink, StatusFilter } from '../types'

export function amountDuePaise(link: PaymentLink): number {
  return Math.max(0, link.amountPaise - link.amountPaidPaise)
}

/**
 * Status is derived, never stored. Precedence:
 * paid in full → Paid (never expires) · expiry ≤ now → Expired · something paid → Partially paid · else Active.
 */
export function getStatus(link: PaymentLink, now: Date): LinkStatus {
  if (link.amountPaidPaise >= link.amountPaise) return 'paid'
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= now.getTime()) return 'expired'
  if (link.amountPaidPaise > 0) return 'partially_paid'
  return 'active'
}

export function filterLinks(links: PaymentLink[], filter: StatusFilter, now: Date): PaymentLink[] {
  if (filter === 'all') return links
  return links.filter((link) => getStatus(link, now) === filter)
}

export function countByStatus(links: PaymentLink[], now: Date): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = { all: links.length, active: 0, partially_paid: 0, paid: 0, expired: 0 }
  for (const link of links) counts[getStatus(link, now)] += 1
  return counts
}

export function sortNewestFirst(links: PaymentLink[]): PaymentLink[] {
  return [...links].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}
