import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useGameDataStore } from './useGameDataStore'
import { useI18n } from 'vue-i18n'
import type { X4MapSector } from '@/types/x4'
import type { ResolvedMapSector } from '@/components/map/mapSectorMacro'

type SectorInfo = {
  id: string
  clusterId: string
  name: string
  displayName: string
  owner: string
  sunlight: number
  hasKhaakHive: boolean
  khaakHiveSourceNames: string[]
}

export const useMapStore = defineStore('map', () => {
  const { t, te } = useI18n()
  const gameDataStore = useGameDataStore()
  const sectorMacroIndex = ref<Map<string, ResolvedMapSector<X4MapSector>>>(new Map())

  const sectorsById = computed<Record<string, SectorInfo>>(() => {
    const out: Record<string, SectorInfo> = {}
    const maps = gameDataStore.maps
    const clusters = maps?.clusters || {}
    const sectors = maps?.sectors || {}
    
    // 第一遍：建立所有 sector 基本信息
    Object.entries(clusters).forEach(([clusterId, cluster]) => {
      if (gameDataStore.enforceDlcActivation && !gameDataStore.isDlcActive(cluster.dlc_tag)) {
        return
      }
      ;(cluster.sectors || []).forEach((sectorId) => {
        const sector = sectors[sectorId] as X4MapSector | undefined
        if (!sector) return
        const displayName = sector.nameId && te(sector.nameId) ? t(sector.nameId) : (sector.name || sector.id)
        out[sector.id] = {
          id: sector.id,
          clusterId,
          name: sector.name || sector.id,
          displayName,
          owner: sector.owner || cluster.owner || 'ownerless',
          sunlight: Math.round(Number(sector.area?.sunlight || 0) * 100),
          hasKhaakHive: sector.has_khaak_hive || false,
          khaakHiveSourceNames: []
        }
      })
    })
    
    // 第二遍：计算来源名称
    Object.values(clusters).forEach((cluster) => {
      if (gameDataStore.enforceDlcActivation && !gameDataStore.isDlcActive(cluster.dlc_tag)) {
        return
      }
      ;(cluster.sectors || []).forEach((sectorId) => {
        const sector = sectors[sectorId] as X4MapSector | undefined
        if (!sector) return
        const sectorInfo = out[sector.id]
        if (!sectorInfo) return
        const sourceIds: string[] = sector.khaak_hive_sources || []
        sectorInfo.khaakHiveSourceNames = sourceIds.map((sourceId: string) => {
          const sourceSector = out[sourceId]
          return sourceSector ? sourceSector.displayName : sourceId
        })
      })
    })
    
    return out
  })

  function normalizeMacro(value: string | null | undefined): string {
    return (value || '').trim().toLowerCase()
  }

  function initialize() {
    const nextIndex = new Map<string, ResolvedMapSector<X4MapSector>>()
    const maps = gameDataStore.maps
    const clusters = maps?.clusters || {}
    const sectors = maps?.sectors || {}

    Object.entries(clusters).forEach(([clusterId, cluster]) => {
      if (gameDataStore.enforceDlcActivation && !gameDataStore.isDlcActive(cluster.dlc_tag)) {
        return
      }
      ;(cluster.sectors || []).forEach((sectorId) => {
        const sector = sectors[sectorId]
        if (!sector) return
        const resolved = { clusterId, sectorId, sector }
        const normalizedSectorId = normalizeMacro(sectorId)
        if (normalizedSectorId) nextIndex.set(normalizedSectorId, resolved)

        const normalizedSectorMacro = normalizeMacro(sector.macro || sector.id)
        if (normalizedSectorMacro) nextIndex.set(normalizedSectorMacro, resolved)
      })
    })

    sectorMacroIndex.value = nextIndex
  }

  function resolveSectorByMacro(macro: string | null | undefined): ResolvedMapSector<X4MapSector> | null {
    const normalizedMacro = normalizeMacro(macro)
    if (!normalizedMacro) return null
    return sectorMacroIndex.value.get(normalizedMacro) || null
  }

  function getSectorInfo(sectorId: string): SectorInfo | undefined {
    return sectorsById.value[sectorId]
  }

  function getSectorDisplayName(sectorId: string): string {
    return sectorsById.value[sectorId]?.displayName || sectorId
  }

  return {
    initialize,
    sectorsById,
    resolveSectorByMacro,
    getSectorInfo,
    getSectorDisplayName
  }
})
