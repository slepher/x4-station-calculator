<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FitMode, FitPanelProps, FitConnectionRow, FitGroupRow } from '@/components/ship-build/fitTypes'
import { useX4I18n } from '@/utils/UseX4I18n'
import type { X4SlotTag } from '@/types/x4'
import slotTagsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/slot_tags.json'

type OptionItem = { id: string; name: string; mk: string | null; race: string | null; tags: string[] }

type AggregatedGroup = {
  key: string
  size: string
  label: string
  slotTypeLabel: string
  totalCount: number
  tags: string[]
  connectionKeys: string[]
  options: OptionItem[]
  groupRows: FitGroupRow[]
}

const props = defineProps<FitPanelProps>()
const { t } = useI18n()
const { translateSlotTag } = useX4I18n()
const slotTags = slotTagsRaw as X4SlotTag[]
const slotTagMap = new Map<string, X4SlotTag>(slotTags.map((tag) => [tag.id, tag]))

const emit = defineEmits<{
  (e: 'update:mode', mode: FitMode): void
  (e: 'assign-connection', payload: { connectionKey: string; equipmentId: string | null }): void
  (e: 'assign-group', payload: { groupKey: string; equipmentId: string | null }): void
}>()

const activeSlotType = ref<'engine' | 'shield' | 'weapon' | 'turret' | 'thruster' | ''>('')
const activeTabKey = ref('')
const searchQuery = ref('')

const slotTypeDefs = [
  { id: 'engine', label: 'E' },
  { id: 'shield', label: 'S' },
  { id: 'weapon', label: 'W' },
  { id: 'turret', label: 'T' },
  { id: 'thruster', label: 'R' }
] as const

const sourceRows = computed(() => props.mode === 'connection' ? props.connectionRows : props.groupRows)

const sizeRank = (size: string) => {
  if (size === 'extralarge') return 0
  if (size === 'large') return 1
  if (size === 'medium') return 2
  if (size === 'small') return 3
  return 4
}

const buildTagSignature = (tags: string[]) => [...tags].sort().join('&')

const sizeShort = (size: string) => {
  if (size === 'small') return 'S'
  if (size === 'medium') return 'M'
  if (size === 'large') return 'L'
  if (size === 'extralarge') return 'XL'
  return size.toUpperCase()
}

const mergeOptions = (rows: Array<{ options: OptionItem[] }>) => {
  const optionMap = new Map<string, OptionItem>()
  rows.forEach((row) => row.options.forEach((opt) => optionMap.set(opt.id, opt)))
  return Array.from(optionMap.values()).sort((a, b) => a.name.localeCompare(b.name))
}

const mergeTags = (rows: Array<{ tags: string[] }>) => {
  const set = new Set<string>()
  rows.forEach((row) => row.tags.forEach((tag) => set.add(tag)))
  return Array.from(set)
}

const getSlotBucket = (row: FitConnectionRow | FitGroupRow) => {
  if (row.slotType === 'shield') return row.parentSlotType
  return row.slotType
}

const setMode = (mode: FitMode) => {
  if (mode === 'group' && !props.canSwitchToGroup) return
  emit('update:mode', mode)
}

const availableSlotTypes = computed(() => {
  const set = new Set(sourceRows.value.map((row) => getSlotBucket(row as FitConnectionRow | FitGroupRow)))
  return slotTypeDefs.filter((item) => set.has(item.id))
})

watch(
  [availableSlotTypes, () => props.mode],
  ([types]) => {
    const firstType = types[0]?.id || ''
    if (!types.some((item) => item.id === activeSlotType.value)) {
      activeSlotType.value = firstType
    }
  },
  { immediate: true }
)

const slotScopedRows = computed(() => {
  const rows = sourceRows.value.filter((row) => !activeSlotType.value || getSlotBucket(row as FitConnectionRow | FitGroupRow) === activeSlotType.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) => `${row.slotTypeLabel} ${row.groupName} ${row.tags.join(' ')}`.toLowerCase().includes(q))
})

const primaryConnectionRows = computed(() => {
  if (props.mode !== 'connection') return [] as FitConnectionRow[]
  return (slotScopedRows.value as FitConnectionRow[]).filter((row) => row.slotType === activeSlotType.value)
})

const primaryGroupRows = computed(() => {
  if (props.mode !== 'group') return [] as FitGroupRow[]
  return (slotScopedRows.value as FitGroupRow[]).filter((row) => row.slotType === activeSlotType.value)
})

const aggregatedPrimaryGroups = computed<AggregatedGroup[]>(() => {
  const bySemanticKey = new Map<string, FitGroupRow[]>()
  primaryGroupRows.value.forEach((row) => {
    const tagSignature = buildTagSignature(row.tags || [])
    const semanticKey = `${row.size}|${tagSignature}`
    const list = bySemanticKey.get(semanticKey) || []
    list.push(row)
    bySemanticKey.set(semanticKey, list)
  })

  const baseGroups = Array.from(bySemanticKey.entries())
    .sort((a, b) => {
      const aSize = a[1][0]?.size || 'unknown'
      const bSize = b[1][0]?.size || 'unknown'
      if (sizeRank(aSize) !== sizeRank(bSize)) return sizeRank(aSize) - sizeRank(bSize)
      return a[0].localeCompare(b[0])
    })
    .map(([semanticKey, rows]) => ({
      key: `agg-primary-${semanticKey}`,
      size: rows[0]?.size || 'unknown',
      label: '',
      slotTypeLabel: rows[0]?.slotTypeLabel || '',
      totalCount: rows.reduce((sum, row) => sum + row.totalCount, 0),
      tags: mergeTags(rows),
      connectionKeys: rows.flatMap((row) => row.connectionKeys),
      options: mergeOptions(rows),
      groupRows: rows
    }))

  const countBySize = new Map<string, number>()
  baseGroups.forEach((group) => countBySize.set(group.size, (countBySize.get(group.size) || 0) + 1))
  const seenBySize = new Map<string, number>()

  return baseGroups.map((group) => {
    const seen = (seenBySize.get(group.size) || 0) + 1
    seenBySize.set(group.size, seen)
    const total = countBySize.get(group.size) || 0
    const suffix = total > 1 ? String(seen) : ''
    return {
      ...group,
      label: `${sizeShort(group.size)}${suffix}`
    }
  })
})

const groupTabs = computed(() => {
  if (props.mode === 'group') {
    return aggregatedPrimaryGroups.value.map((group) => ({ key: group.key, label: group.label }))
  }

  const rows = primaryConnectionRows.value
  const totalBySize = new Map<string, number>()
  rows.forEach((row) => totalBySize.set(row.size, (totalBySize.get(row.size) || 0) + 1))

  const seenBySize = new Map<string, number>()
  return rows.map((row) => {
    const seen = (seenBySize.get(row.size) || 0) + 1
    seenBySize.set(row.size, seen)
    const total = totalBySize.get(row.size) || 0
    const suffix = total > 1 ? String(seen) : ''
    return {
      key: row.connectionKey,
      label: `${sizeShort(row.size)}${suffix}`
    }
  })
})

watch(
  [groupTabs, () => props.mode],
  ([tabs]) => {
    if (!tabs.some((tab) => tab.key === activeTabKey.value)) {
      activeTabKey.value = tabs[0]?.key || ''
    }
  },
  { immediate: true }
)

const activeConnectionRow = computed<FitConnectionRow | null>(() => {
  if (props.mode !== 'connection') return null
  return primaryConnectionRows.value.find((row) => row.connectionKey === activeTabKey.value) || null
})

const activePrimaryAggregate = computed<AggregatedGroup | null>(() => {
  if (props.mode !== 'group') return null
  return aggregatedPrimaryGroups.value.find((group) => group.key === activeTabKey.value) || null
})

const selectedForConnectionKeys = (keys: string[]) => {
  const selected = keys
    .map((key) => props.selectedByConnection[key])
    .filter((item): item is string => Boolean(item))
  if (selected.length === 0) return ''
  const first = selected[0]
  if (!first) return ''
  return selected.every((item) => item === first) ? first : '__mixed__'
}

const connectionCountMap = computed(() => {
  const map = new Map<string, number>()
  props.connectionRows.forEach((row) => map.set(row.connectionKey, row.count))
  return map
})

const selectedCountForConnectionKeys = (keys: string[]) => {
  return keys.reduce((sum, key) => {
    const selected = props.selectedByConnection[key]
    if (!selected) return sum
    return sum + (connectionCountMap.value.get(key) || 0)
  }, 0)
}

const totalCountForConnectionKeys = (keys: string[]) => {
  return keys.reduce((sum, key) => sum + (connectionCountMap.value.get(key) || 0), 0)
}

const relatedShieldConnectionRows = computed<FitConnectionRow[]>(() => {
  if (props.mode !== 'connection' || !activeConnectionRow.value) return []
  const targetShieldKey = `${activeConnectionRow.value.connectionKey}::shield`
  return props.connectionRows.filter((row) => row.connectionKey === targetShieldKey)
})

const relatedShieldAggregates = computed<AggregatedGroup[]>(() => {
  if (props.mode !== 'group' || !activePrimaryAggregate.value) return []

  const shieldRows = activePrimaryAggregate.value.connectionKeys
    .map((key) => props.connectionRows.find((row) => row.connectionKey === `${key}::shield`))
    .filter((row): row is FitConnectionRow => Boolean(row))

  const bySemanticKey = new Map<string, FitConnectionRow[]>()
  shieldRows.forEach((row) => {
    const parentTagSignature = buildTagSignature(row.parentConnectionTags || [])
    const shieldTagSignature = buildTagSignature(row.tags || [])
    const semanticKey = `${row.parentConnectionSize}|${parentTagSignature}|${row.size}|${shieldTagSignature}`
    const list = bySemanticKey.get(semanticKey) || []
    list.push(row)
    bySemanticKey.set(semanticKey, list)
  })

  return Array.from(bySemanticKey.entries())
    .sort((a, b) => {
      const aSize = a[1][0]?.size || 'unknown'
      const bSize = b[1][0]?.size || 'unknown'
      return sizeRank(aSize) - sizeRank(bSize)
    })
    .map(([semanticKey, rows]) => ({
      key: `agg-shield-${semanticKey}`,
      size: rows[0]?.size || 'unknown',
      label: sizeShort(rows[0]?.size || 'unknown'),
      slotTypeLabel: rows[0]?.slotTypeLabel || '',
      totalCount: rows.reduce((sum, row) => sum + row.count, 0),
      tags: mergeTags(rows),
      connectionKeys: rows.map((row) => row.connectionKey),
      options: mergeOptions(rows),
      groupRows: []
    }))
})

const compatibilityTags = computed(() => {
  if (props.mode === 'connection') return activeConnectionRow.value?.tags || []
  return activePrimaryAggregate.value?.tags || []
})

const visibleCompatibilityTags = computed<X4SlotTag[]>(() => {
  const unique = new Set<string>()
  const visible: X4SlotTag[] = []
  compatibilityTags.value.forEach((tag) => {
    if (unique.has(tag)) return
    const tagDef = slotTagMap.get(tag)
    if (!tagDef) return
    unique.add(tag)
    visible.push(tagDef)
  })
  return visible
})

const visibleCompatibilityTagLabels = computed(() =>
  visibleCompatibilityTags.value.map((tag) => translateSlotTag(tag))
)

const activePrimarySlotTypeLabel = computed(() => {
  if (props.mode === 'connection') return activeConnectionRow.value?.slotTypeLabel || activeSlotType.value
  if (!activePrimaryAggregate.value) return activeSlotType.value
  const rowLabel = activePrimaryAggregate.value.groupRows[0]?.slotTypeLabel
  return rowLabel || activeSlotType.value
})

const compatibilitySlotLines = computed(() => {
  if (props.mode === 'connection') {
    if (!activeConnectionRow.value) return []
    const lines = [`${sizeShort(activeConnectionRow.value.size)} ${activeConnectionRow.value.slotTypeLabel} x${activeConnectionRow.value.count}`]
    relatedShieldConnectionRows.value.forEach((row) => {
      lines.push(`${sizeShort(row.size)} ${row.slotTypeLabel} x${row.count}`)
    })
    return lines
  }

  if (!activePrimaryAggregate.value) return []
  const lines = [`${sizeShort(activePrimaryAggregate.value.size)} ${activePrimarySlotTypeLabel.value} x${activePrimaryAggregate.value.totalCount}`]
  relatedShieldAggregates.value.forEach((group) => {
    lines.push(`${sizeShort(group.size)} ${group.slotTypeLabel} x${group.totalCount}`)
  })
  return lines
})

const assignConnectionRow = (row: FitConnectionRow, equipmentId: string) => {
  emit('assign-connection', { connectionKey: row.connectionKey, equipmentId })
}

const assignAggregatedGroup = (group: AggregatedGroup, equipmentId: string) => {
  if (group.groupRows.length === 0) {
    group.connectionKeys.forEach((connectionKey) => {
      emit('assign-connection', { connectionKey, equipmentId })
    })
    return
  }
  group.groupRows.forEach((row) => {
    emit('assign-group', { groupKey: row.groupKey, equipmentId })
  })
}
</script>

<template>
  <div class="arsenal-shell">
    <aside class="left-rail">
      <button
        v-for="slotType in availableSlotTypes"
        :key="slotType.id"
        class="slot-type-btn"
        :class="activeSlotType === slotType.id ? 'slot-type-btn-active' : ''"
        @click="activeSlotType = slotType.id"
      >
        {{ slotType.label }}
      </button>
    </aside>

    <main class="arsenal-main">
      <div class="toolbar-row">
        <div class="mode-tabs">
          <button class="mode-tab" :class="mode === 'connection' ? 'active' : ''" @click="setMode('connection')">{{ t('ship_build.fit_mode_connection') }}</button>
          <button class="mode-tab" :class="mode === 'group' ? 'active' : ''" :disabled="!canSwitchToGroup" @click="setMode('group')">{{ t('ship_build.fit_mode_group') }}</button>
        </div>
        <input v-model="searchQuery" class="search-input" :placeholder="t('ship_build.fit_search_placeholder')" />
      </div>

      <div class="group-tabs">
        <button
          v-for="tab in groupTabs"
          :key="tab.key"
          class="group-tab"
          :class="activeTabKey === tab.key ? 'group-tab-active' : ''"
          @click="activeTabKey = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="!canSwitchToGroup" class="conflict-line">{{ conflictReason }}</div>

      <section v-if="visibleCompatibilityTags.length > 0" class="compatibility-box">
        <div class="compatibility-title">{{ t('ship_build.fit_compatibility') }}:</div>
        <div class="compatibility-line tags">{{ visibleCompatibilityTagLabels.join(' / ') }}</div>
        <div v-for="line in compatibilitySlotLines" :key="line" class="compatibility-line">{{ line }}</div>
      </section>

      <section class="option-wall">
        <template v-if="mode === 'connection' && activeConnectionRow">
          <div class="wall-section">
            <div class="wall-header">
              <span>{{ activeConnectionRow.slotTypeLabel }}</span>
              <span class="picked">
                {{ selectedCountForConnectionKeys([activeConnectionRow.connectionKey]) }}/{{ activeConnectionRow.count }}
              </span>
            </div>
            <div class="card-grid">
              <button
                v-for="option in activeConnectionRow.options"
                :key="option.id"
                class="option-card"
                :class="selectedForConnectionKeys([activeConnectionRow.connectionKey]) === option.id ? 'option-card-active' : ''"
                @click="assignConnectionRow(activeConnectionRow, option.id)"
              >
                <div class="card-name">{{ option.name }}</div>
                <div class="card-meta">{{ option.race || 'GEN' }} · MK{{ option.mk || '?' }}</div>
              </button>
              <div v-if="activeConnectionRow.options.length === 0" class="empty-card">{{ t('ship_build.fit_no_equipment') }}</div>
            </div>
          </div>

          <div v-for="shieldRow in relatedShieldConnectionRows" :key="shieldRow.connectionKey" class="wall-section">
            <div class="wall-header">
              <span>{{ shieldRow.slotTypeLabel }}</span>
              <span class="picked">
                {{ selectedCountForConnectionKeys([shieldRow.connectionKey]) }}/{{ shieldRow.count }}
              </span>
            </div>
            <div class="card-grid">
              <button
                v-for="option in shieldRow.options"
                :key="option.id"
                class="option-card"
                :class="selectedForConnectionKeys([shieldRow.connectionKey]) === option.id ? 'option-card-active' : ''"
                @click="assignConnectionRow(shieldRow, option.id)"
              >
                <div class="card-name">{{ option.name }}</div>
                <div class="card-meta">{{ option.race || 'GEN' }} · MK{{ option.mk || '?' }}</div>
              </button>
              <div v-if="shieldRow.options.length === 0" class="empty-card">{{ t('ship_build.fit_no_equipment') }}</div>
            </div>
          </div>
        </template>

        <template v-else-if="mode === 'group' && activePrimaryAggregate">
          <div class="wall-section">
            <div class="wall-header">
              <span>{{ activePrimarySlotTypeLabel }}</span>
              <span class="picked">
                {{ selectedCountForConnectionKeys(activePrimaryAggregate.connectionKeys) }}/{{ totalCountForConnectionKeys(activePrimaryAggregate.connectionKeys) }}
              </span>
            </div>
            <div class="card-grid">
              <button
                v-for="option in activePrimaryAggregate.options"
                :key="option.id"
                class="option-card"
                :class="selectedForConnectionKeys(activePrimaryAggregate.connectionKeys) === option.id ? 'option-card-active' : ''"
                @click="assignAggregatedGroup(activePrimaryAggregate, option.id)"
              >
                <div class="card-name">{{ option.name }}</div>
                <div class="card-meta">{{ option.race || 'GEN' }} · MK{{ option.mk || '?' }}</div>
              </button>
              <div v-if="activePrimaryAggregate.options.length === 0" class="empty-card">{{ t('ship_build.fit_no_equipment') }}</div>
            </div>
          </div>

          <div v-for="shieldGroup in relatedShieldAggregates" :key="shieldGroup.key" class="wall-section">
            <div class="wall-header">
              <span>{{ shieldGroup.slotTypeLabel }}</span>
              <span class="picked">
                {{ selectedCountForConnectionKeys(shieldGroup.connectionKeys) }}/{{ totalCountForConnectionKeys(shieldGroup.connectionKeys) }}
              </span>
            </div>
            <div class="card-grid">
              <button
                v-for="option in shieldGroup.options"
                :key="option.id"
                class="option-card"
                :class="selectedForConnectionKeys(shieldGroup.connectionKeys) === option.id ? 'option-card-active' : ''"
                @click="assignAggregatedGroup(shieldGroup, option.id)"
              >
                <div class="card-name">{{ option.name }}</div>
                <div class="card-meta">{{ option.race || 'GEN' }} · MK{{ option.mk || '?' }}</div>
              </button>
              <div v-if="shieldGroup.options.length === 0" class="empty-card">{{ t('ship_build.fit_no_equipment') }}</div>
            </div>
          </div>
        </template>

        <div v-else class="empty-card">{{ t('ship_build.fit_no_equipment') }}</div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.arsenal-shell { @apply rounded-lg border border-sky-700/40 bg-[#032042] p-2 flex gap-2; }
.left-rail { @apply w-9 rounded bg-[#00152f] border border-sky-900/70 flex flex-col items-center gap-2 py-2; }
.slot-type-btn { @apply w-6 h-6 rounded-full border border-slate-500/70 bg-slate-800/80 text-[10px] font-bold text-slate-200; }
.slot-type-btn-active { @apply border-cyan-300 bg-[#2a86dd] text-white; }
.arsenal-main { @apply flex-1 min-w-0; }
.toolbar-row { @apply flex items-center justify-between gap-2; }
.mode-tabs { @apply inline-flex border border-sky-500/70 rounded overflow-hidden; }
.mode-tab { @apply px-2.5 py-1 text-xs font-semibold text-slate-200 bg-[#0d315f] border-r border-sky-500/60; }
.mode-tab:last-child { border-right: 0; }
.mode-tab.active { @apply bg-[#1f73c6] text-white; }
.mode-tab:disabled { @apply opacity-40 cursor-not-allowed; }
.search-input { @apply w-24 rounded bg-[#041937] border border-sky-600/60 text-xs text-slate-100 px-2 py-1; }
.group-tabs { @apply flex items-center gap-1 mt-2; }
.group-tab { @apply px-2.5 py-0.5 text-[11px] border border-sky-500/60 rounded bg-[#07264a] text-slate-200; }
.group-tab-active { @apply bg-[#2a86dd] text-white; }
.conflict-line { @apply text-[10px] text-amber-300 mt-1; }
.compatibility-box { @apply mt-2 rounded border border-sky-700/60 bg-[#04254a] px-2 py-1.5; }
.compatibility-title { @apply text-xs text-slate-100 font-semibold mb-0.5; }
.compatibility-line { @apply text-[11px] text-slate-200; }
.compatibility-line.tags { @apply text-sky-200; }
.option-wall { @apply min-w-0 mt-2; }
.wall-section { @apply mb-2; }
.wall-header { @apply flex items-center justify-between text-xs text-slate-100 mb-1; }
.picked { @apply text-emerald-300; }
.card-grid { @apply grid grid-cols-3 gap-1 pr-1; }
.option-card { @apply rounded border border-sky-700 bg-[#0a3c73] p-1 text-left; }
.option-card-active { @apply border-emerald-300 ring-1 ring-emerald-400; }
.card-name { @apply text-[11px] text-slate-100 leading-tight line-clamp-2 min-h-[1.8rem]; }
.card-meta { @apply text-[10px] text-slate-300 mt-0.5; }
.empty-card { @apply rounded border border-dashed border-sky-700 p-3 text-xs text-slate-300 text-center; }
@media (max-width: 1024px) {
  .card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
