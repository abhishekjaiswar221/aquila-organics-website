import { describe, expect, it } from 'vitest'
import { classifyQuery } from '@/lib/search'

describe('classifyQuery', () => {
  it('classifies hyphenated CAS', () =>
    expect(classifyQuery('64-17-5')).toEqual({ kind: 'cas', casNormalized: '64175' }))
  it('classifies digits-only CAS', () =>
    expect(classifyQuery('64175')).toEqual({ kind: 'cas', casNormalized: '64175' }))
  it('classifies names as text', () =>
    expect(classifyQuery('vanill')).toEqual({ kind: 'text', text: 'vanill' }))
  it('treats blank as empty', () => expect(classifyQuery('  ')).toEqual({ kind: 'empty' }))
  it('treats undefined as empty', () => expect(classifyQuery(undefined)).toEqual({ kind: 'empty' }))
  it('truncates text to 100 chars', () => {
    const result = classifyQuery('a'.repeat(500))
    expect(result).toEqual({ kind: 'text', text: 'a'.repeat(100) })
  })
  it('does not escape LIKE characters', () =>
    expect(classifyQuery("%_'")).toEqual({ kind: 'text', text: "%_'" }))
  it('treats an invalid-checksum number as text', () =>
    expect(classifyQuery('64-17-6')).toEqual({ kind: 'text', text: '64-17-6' }))
})
