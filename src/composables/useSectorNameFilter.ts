import { computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMapStore } from '@/store/useMapStore'
import { getLocalizedSectorQueryMatch } from '@/components/map/savePoiSearch'

export interface SectorWithName {
  sectorMacro: string
  rawSectorName: string
  sectorName: string
  showRawSectorName: boolean
}

export function useSectorNameFilter(searchQuery: Ref<string>) {
  const { t, te, locale } = useI18n()
  const mapStore = useMapStore()

  function getSectorDisplayName(sectorMacro: string, fallbackName: string): SectorWithName {
    const resolved = mapStore.resolveSectorByMacro(sectorMacro)
    if (resolved) {
      const rawName = (resolved.sector as any).name || fallbackName
      const nameId = (resolved.sector as any).nameId
      if (nameId && te(nameId)) {
        return {
          sectorMacro,
          rawSectorName: rawName,
          sectorName: t(nameId),
          showRawSectorName: false
        }
      }
      return {
        sectorMacro,
        rawSectorName: rawName,
        sectorName: rawName,
        showRawSectorName: false
      }
    }
    return {
      sectorMacro,
      rawSectorName: fallbackName,
      sectorName: fallbackName,
      showRawSectorName: false
    }
  }

  const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase())

  function filterSectors<T extends SectorWithName>(sectors: T[]): T[] {
    if (!normalizedQuery.value) return sectors

    return sectors.filter((sector) =>
      getLocalizedSectorQueryMatch({
        rawName: sector.rawSectorName,
        displayName: sector.sectorName,
        normalizedQuery: normalizedQuery.value,
        locale: locale.value
      }).matched
    )
  }

  function computeShowRawSectorName(
    sector: SectorWithName,
    match: ReturnType<typeof getLocalizedSectorQueryMatch>
  ): boolean {
    if (locale.value === 'en') return false
    if (sector.rawSectorName === sector.sectorName) return false
    if (!normalizedQuery.value) return false
    return match.matchedRawName && !match.matchedDisplayName
  }

  return {
    getSectorDisplayName,
    normalizedQuery,
    filterSectors,
    computeShowRawSectorName
  }
}