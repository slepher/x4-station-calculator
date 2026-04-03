export interface LocalizedSectorSearchInput {
  rawName: string
  displayName: string
  normalizedQuery: string
  locale: string
}

export interface LocalizedSectorSearchMatch {
  matched: boolean
  matchedRawName: boolean
  matchedDisplayName: boolean
}

export function getLocalizedSectorQueryMatch(input: LocalizedSectorSearchInput): LocalizedSectorSearchMatch {
  if (!input.normalizedQuery) {
    return {
      matched: true,
      matchedRawName: false,
      matchedDisplayName: false
    }
  }

  const rawName = input.rawName.toLowerCase()
  const displayName = input.displayName.toLowerCase()
  const matchedRawName = rawName.includes(input.normalizedQuery)
  const matchedDisplayName = input.locale !== 'en' && displayName.includes(input.normalizedQuery)

  return {
    matched: matchedRawName || matchedDisplayName,
    matchedRawName,
    matchedDisplayName
  }
}

export function matchesLocalizedSectorQuery(input: LocalizedSectorSearchInput): boolean {
  return getLocalizedSectorQueryMatch(input).matched
}
