import { describe, expect, it } from 'vitest'
import { formatCas, isValidCas, normalizeCas } from '@/lib/cas'

describe('isValidCas', () => {
  it('accepts ethanol', () => expect(isValidCas('64-17-5')).toBe(true))
  it('rejects a bad checksum', () => expect(isValidCas('64-17-6')).toBe(false))
  it('rejects non-hyphenated input', () => expect(isValidCas('64175')).toBe(false))
  it('rejects garbage', () => expect(isValidCas('abc')).toBe(false))
})

describe('normalizeCas', () => {
  it('normalises digits-only input', () => expect(normalizeCas('64175')).toBe('64175'))
  it('normalises hyphenated input', () => expect(normalizeCas('64-17-5')).toBe('64175'))
  it('trims whitespace', () => expect(normalizeCas(' 64-17-5 ')).toBe('64175'))
  it('rejects a bad checksum', () => expect(normalizeCas('64-17-6')).toBeNull())
  it('rejects letters', () => expect(normalizeCas('abc')).toBeNull())
  it('rejects empty', () => expect(normalizeCas('')).toBeNull())
})

describe('formatCas', () => {
  it('inserts hyphens', () => expect(formatCas('64175')).toBe('64-17-5'))
  it('handles longer numbers', () => expect(formatCas('7732185')).toBe('7732-18-5'))
})
