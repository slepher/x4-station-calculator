import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useGameDataStore } from './useGameDataStore'
import { useI18n } from 'vue-i18n'

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

  const sectorsById = computed<Record<string, SectorInfo>>(() => {
    const out: Record<string, SectorInfo> = {}
    const clusters = gameDataStore.maps?.clusters || {}
    
    // 第一遍：建立所有 sector 基本信息
    Object.entries(clusters).forEach(([clusterId, cluster]) => {
      if (gameDataStore.enforceDlcActivation && !gameDataStore.isDlcActive(cluster.dlc_tag)) {
        return
      }
      Object.values(cluster.sectors || {}).forEach((sector: any) => {
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
      Object.values(cluster.sectors || {}).forEach((sector: any) => {
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

  function getSectorInfo(sectorId: string): SectorInfo | undefined {
    return sectorsById.value[sectorId]
  }

  function getSectorDisplayName(sectorId: string): string {
    return sectorsById.value[sectorId]?.displayName || sectorId
  }

  return {
    sectorsById,
    getSectorInfo,
    getSectorDisplayName
  }
})