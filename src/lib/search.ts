import { normalizeCas } from '@/lib/cas'

export type SearchQuery =
  | { kind: 'cas'; casNormalized: string }
  | { kind: 'text'; text: string }
  | { kind: 'empty' }

const MAX_TEXT_LENGTH = 100

export function classifyQuery(raw: string | undefined): SearchQuery {
  const trimmed = (raw ?? '').trim()
  if (trimmed === '') return { kind: 'empty' }
  const casNormalized = normalizeCas(trimmed)
  if (casNormalized !== null) return { kind: 'cas', casNormalized }
  return { kind: 'text', text: trimmed.slice(0, MAX_TEXT_LENGTH) }
}
