import type { StatusFilter } from '../types'

export const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paid', label: 'Paid' },
  { value: 'expired', label: 'Expired' },
]

export function emptyStateMessage(filter: StatusFilter): string {
  if (filter === 'all') return 'No payment links yet. Create one using the form above.'
  const label = FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? filter
  return `No ${label.toLowerCase()} links.`
}
