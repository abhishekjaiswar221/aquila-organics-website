const CAS_FORMAT = /^\d{2,7}-\d{2}-\d$/

function checksumOk(digits: string): boolean {
  const body = digits.slice(0, -1)
  const check = Number(digits.slice(-1))
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    const weight = i + 1
    sum += Number(body[body.length - 1 - i]) * weight
  }
  return sum % 10 === check
}

export function isValidCas(input: string): boolean {
  if (!CAS_FORMAT.test(input)) return false
  return checksumOk(input.replace(/-/g, ''))
}

export function formatCas(digits: string): string {
  return `${digits.slice(0, -3)}-${digits.slice(-3, -1)}-${digits.slice(-1)}`
}

export function normalizeCas(input: string): string | null {
  const trimmed = input.trim()
  if (/^\d{5,10}$/.test(trimmed)) {
    return checksumOk(trimmed) ? trimmed : null
  }
  return isValidCas(trimmed) ? trimmed.replace(/-/g, '') : null
}
