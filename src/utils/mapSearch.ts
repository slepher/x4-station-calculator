/**
 * Map Search Utility Functions
 * Extracted for unit testing
 */

export type SearchSectorLayout = {
  sectorId: string
  clusterId: string
  name: string
  displayName: string
  centerX: number
  centerY: number
}

export type SearchResultItem = SearchSectorLayout & {
  matchType: 'name' | 'localeName' | 'id'
}

/**
 * Parse cluster number from query string like "cluster 01"
 * Returns null if query doesn't match the expected format
 */
export function parseClusterQuery(query: string): string | null {
  const match = query.match(/^cluster[\s_-]*([0-9]+)$/i)
  if (!match?.[1]) return null
  return String(Number(match[1]))
}

/**
 * Extract cluster number from cluster id like "Cluster_01_macro"
 * Returns null if the id doesn't contain a valid cluster number
 */
export function extractClusterNumber(clusterId: string): string | null {
  const match = clusterId.match(/^cluster_([0-9]+)(?:_|$)/i)
  if (!match?.[1]) return null
  return String(Number(match[1]))
}

/**
 * Perform search on sector list
 */
export function searchSectors(
  sectors: SearchSectorLayout[],
  query: string,
  locale: string
): SearchResultItem[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []

  const clusterNumber = parseClusterQuery(normalizedQuery)
  if (clusterNumber) {
    return sectors
      .filter((item) => extractClusterNumber(item.clusterId) === clusterNumber)
      .map((item) => ({ ...item, matchType: 'id' as const }))
  }

  return sectors.flatMap((item) => {
    const rawName = item.name.toLowerCase()
    const displayName = item.displayName.toLowerCase()
    const matched: SearchResultItem[] = []
    if (rawName.includes(normalizedQuery)) {
      matched.push({ ...item, matchType: 'name' })
      return matched
    }
    if (locale !== 'en' && displayName.includes(normalizedQuery)) {
      matched.push({ ...item, matchType: 'localeName' })
    }
    return matched
  })
}

/**
 * Calculate highlighted sector ids based on search results
 * Returns empty array if results >= 10
 */
export function calculateHighlightedSectorIds(
  query: string,
  results: SearchResultItem[]
): string[] {
  if (!query.trim()) return []
  if (results.length >= 10) return []
  return results.map((item) => item.sectorId)
}

/**
 * Check if any result is an id match
 */
export function hasIdMatchedResult(results: SearchResultItem[]): boolean {
  return results.some((item) => item.matchType === 'id')
}

/**
 * Get result primary label based on locale
 */
export function getResultPrimaryLabel(
  item: SearchSectorLayout,
  locale: string
): string {
  return locale === 'en' ? item.name : item.displayName
}

/**
 * Get result meta text based on match type and locale
 */
export function getResultMeta(
  item: SearchResultItem,
  locale: string
): string {
  if (item.matchType === 'id') return item.sectorId
  if (item.matchType === 'name' && locale !== 'en') return item.name
  return ''
}