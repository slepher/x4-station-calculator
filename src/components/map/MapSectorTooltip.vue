<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMapStore } from '@/store/useMapStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { formatNumber } from '@/utils/numberFormatter'
import { sortResourcesByPriority, RATING_TO_YIELD_NAME } from '@/store/logic/mapResourceFilter'

const props = defineProps<{
  sectorId: string
  sectorOwnerOverride?: Record<string, string>
}>()

const { t, te } = useI18n()
const mapStore = useMapStore()
const gameDataStore = useGameDataStore()

const sectorInfo = computed(() => mapStore.getSectorInfo(props.sectorId))

const title = computed(() => sectorInfo.value?.displayName || props.sectorId)

const overrideOwner = computed(() => {
  if (props.sectorOwnerOverride && props.sectorOwnerOverride[props.sectorId]) {
    return props.sectorOwnerOverride[props.sectorId]
  }
  return null
})

const ownerRaw = computed(() => overrideOwner.value || sectorInfo.value?.owner || 'ownerless')

const ownerName = computed(() => {
  const owner = ownerRaw.value
  if (owner === 'ownerless') return t('map.owner_ownerless')
  
  const faction = gameDataStore.factions?.find(f => f.id === owner)
  if (faction?.nameId && te(faction.nameId)) {
    return t(faction.nameId)
  }
  return faction?.name || owner
})

const sunlightPercent = computed(() => sectorInfo.value?.sunlight || 0)

const sunlightYieldInfo = computed(() => {
  const percent = sunlightPercent.value
  let yieldName = 'low'
  if (percent >= 200) yieldName = 'high'
  else if (percent >= 125) yieldName = 'midhigh'
  else if (percent >= 80) yieldName = 'medium'
  else if (percent >= 50) yieldName = 'midlow'
  else yieldName = 'low'
  return {
    yieldName,
    yieldLabel: t(`map.yield_levels.${yieldName}`)
  }
})
const hasKhaakHive = computed(() => sectorInfo.value?.hasKhaakHive || false)
const khaakHiveSourceNames = computed(() => sectorInfo.value?.khaakHiveSourceNames || [])

const resourceColorByWare = computed(() => {
  const map: Record<string, string> = {}
  for (const entry of gameDataStore.res || []) {
    map[entry.id] = entry.color_rgb
  }
  return map
})

const resources = computed(() => {
  const sector = gameDataStore.maps?.sectors?.[props.sectorId]
  if (!sector || !Array.isArray((sector as any).resources)) return []
  const resourceList = (sector as any).resources as Array<{ ware: string; rating?: number; respawn?: number }>
  const sortedWareIds = sortResourcesByPriority(resourceList.map(r => r.ware))
  const resourceMap = Object.fromEntries(resourceList.map(r => [r.ware, r]))
  return sortedWareIds.map(wareId => {
    const entry = resourceMap[wareId]
    const rating = entry?.rating ?? 1
    const yieldName = RATING_TO_YIELD_NAME[rating] || 'low'
    return {
      wareId,
      label: gameDataStore.getWareDisplayName(wareId) || wareId,
      respawn: formatNumber(entry?.respawn ?? 0),
      color: resourceColorByWare.value[wareId] || '#fbbf24',
      rating,
      yieldName,
      yieldLabel: t(`map.yield_levels.${yieldName}`)
    }
  })
})

const sectorCenterPos = computed(() => {
  const sector = gameDataStore.maps?.sectors?.[props.sectorId] as
    | { raw_center_pos?: { x?: number; y?: number; z?: number } }
    | undefined
  const center = sector?.raw_center_pos
  if (center?.x === undefined || center?.z === undefined) return null
  const formatKm = (value: number) => `${Math.round(value / 1000)}km`
  return `(${formatKm(center.x)}, ${formatKm(center.z)})`
})
</script>

<template>
  <section class="sector-tooltip-card">
    <header class="sector-tooltip-header">
      <h3 class="sector-tooltip-title">{{ title }}</h3>
      <p class="sector-tooltip-owner">{{ ownerName }}</p>
    </header>

    <div class="sector-tooltip-grid">
      <span class="resource-name sunlight-name">{{ t('map.resource_filter_sunlight') }}</span>
      <span class="resource-value">{{ sunlightPercent }}{{ t('map.resource_filter_sunlight_suffix') }}</span>
      <span class="resource-rating">{{ sunlightYieldInfo.yieldLabel }}</span>

      <template v-for="resource in resources" :key="resource.wareId">
        <span class="resource-name" :style="{ color: resource.color }">{{ resource.label }}</span>
        <span class="resource-value">{{ resource.respawn }}</span>
        <span class="resource-rating">{{ resource.yieldLabel }}</span>
      </template>
    </div>

    <div v-if="sectorCenterPos" class="sector-center-line">
      <span class="sector-center-label">{{ t('map.sector_center_coords') }}</span>
      <span class="sector-center-value" data-testid="map-sector-tooltip-center">{{ sectorCenterPos }}</span>
    </div>

    <div v-if="hasKhaakHive || khaakHiveSourceNames.length > 0" class="khaak-info">
      <div v-if="hasKhaakHive" class="khaak-line">{{ t('map.khaak_hive') }}</div>
      <div v-if="khaakHiveSourceNames.length > 0" class="khaak-sources-section">
        <div class="khaak-label">{{ t('map.potential_khaak_hive_sector') }}:</div>
        <div class="khaak-sources">
          <span v-for="name in khaakHiveSourceNames" :key="name" class="khaak-source-item">{{ name }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sector-tooltip-card {
  min-width: 220px;
  max-width: 280px;
  user-select: none;
  border-radius: 16px;
  border: 1px solid rgba(252, 211, 77, 0.28);
  background:
    linear-gradient(180deg, rgba(30, 24, 16, 0.96), rgba(10, 10, 10, 0.96));
  box-shadow:
    0 18px 50px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  padding: 16px 18px;
  color: #fff7ed;
}

.sector-tooltip-header {
  margin-bottom: 14px;
  text-align: center;
}

.sector-tooltip-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.15;
  font-weight: 500;
  color: #fffbeb;
}

.sector-tooltip-owner {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.2;
  color: rgba(255, 251, 235, 0.82);
}

.sector-tooltip-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px 14px;
  align-items: center;
}

.resource-name {
  font-size: 13px;
  line-height: 1.2;
  color: rgba(255, 247, 237, 0.9);
}

.sunlight-name {
  color: #facc15;
}

.resource-value {
  font-size: 13px;
  line-height: 1.2;
  font-weight: 600;
  text-align: right;
  color: rgba(255, 247, 237, 0.82);
}

.resource-rating {
  font-size: 13px;
  line-height: 1.2;
  text-align: right;
  color: rgba(255, 247, 237, 0.82);
}

.sector-center-line {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(252, 211, 77, 0.2);
  display: grid;
  gap: 4px;
}

.sector-center-label {
  font-size: 12px;
  color: rgba(255, 247, 237, 0.7);
}

.sector-center-value {
  font-size: 12px;
  line-height: 1.35;
  color: rgba(255, 247, 237, 0.92);
  font-family: Consolas, 'Courier New', monospace;
}

.khaak-info {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(252, 211, 77, 0.2);
}

.khaak-line {
  font-size: 13px;
  line-height: 1.4;
  color: rgba(255, 247, 237, 0.9);
}

.khaak-label {
  font-size: 12px;
  color: rgba(255, 247, 237, 0.7);
  margin-bottom: 4px;
}

.khaak-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.khaak-source-item {
  font-size: 12px;
  color: rgba(255, 247, 237, 0.9);
  background: rgba(252, 211, 77, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
