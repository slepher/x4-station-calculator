export function normalizeSectorLinkKey(a: string, b: string): string | null {
  const left = (a || '').trim()
  const right = (b || '').trim()
  if (!left || !right || left === right) return null
  return left < right ? `${left}|${right}` : `${right}|${left}`
}

export function parseSectorLinkKey(key: string): { a: string; b: string } | null {
  if (typeof key !== 'string') return null
  const parts = key.split('|')
  if (parts.length !== 2) return null
  const a = parts[0]?.trim() || ''
  const b = parts[1]?.trim() || ''
  if (!a || !b || a === b) return null
  return { a, b }
}

export function normalizeSectorLinks(rawLinks: unknown, validSectorIds: Set<string>): string[] {
  if (!Array.isArray(rawLinks)) return []
  const set = new Set<string>()
  rawLinks.forEach((item) => {
    if (typeof item !== 'string') return
    const parsed = parseSectorLinkKey(item)
    if (!parsed) return
    if (!validSectorIds.has(parsed.a) || !validSectorIds.has(parsed.b)) return
    const normalized = normalizeSectorLinkKey(parsed.a, parsed.b)
    if (!normalized) return
    set.add(normalized)
  })
  return Array.from(set)
}
