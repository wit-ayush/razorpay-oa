import { FILTER_OPTIONS } from '../lib/filters'
import type { StatusFilter } from '../types'

interface StatusFilterBarProps {
  value: StatusFilter
  counts: Record<StatusFilter, number>
  onChange: (filter: StatusFilter) => void
}

export function StatusFilterBar({ value, counts, onChange }: StatusFilterBarProps) {
  return (
    <fieldset className="filters">
      <legend className="visually-hidden">Filter links by status</legend>
      {FILTER_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="filters__button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label} ({counts[option.value]})
        </button>
      ))}
    </fieldset>
  )
}
