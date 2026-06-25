<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import type { ShipBlueprint } from '@/types/x4'
import { computed, watch } from 'vue'

const { translateEquipmentType } = useX4I18n()

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits(['close'])
const { t } = useI18n()
const store = useShipBuildStore()

const formatDate = (ts: number) => new Date(ts).toLocaleString()

const toggleFavoriteItem = (bpId: string) => {
  store.toggleFavoriteBlueprint(bpId)
  if (bpId !== (store.blueprint?.id ?? '')) {
    store.saveBlueprintsToStorage()
  }
}

// Reload blueprints from storage when modal opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    store.loadBlueprintsFromStorage()
  }
})

const currentShipId = computed(() => {
  const blueprintShipId = store.blueprint?.shipId
  if (blueprintShipId) return blueprintShipId
  return store.selectedShipId
})

const blueprints = computed(() => store.getLoadableBlueprintsForShip(currentShipId.value))

const getSlotTypeLabel = (slotType: string) => {
  const equipmentType = store.findEquipmentType(slotType)
  if (equipmentType) return translateEquipmentType(equipmentType)
  return slotType
}

const getEquipmentStats = (blueprint: ShipBlueprint) => {
  // 按 slot_type + size 分组统计，避免依赖装备类型翻译导致槽位聚合错误
  const stats: Record<string, Record<string, number>> = {}
  const sizeOrder = ['extralarge', 'large', 'medium', 'small']
  const slotOrder = ['engine', 'thruster', 'shield', 'weapon', 'turret']
  const sizePrefix: Record<string, string> = {
    extralarge: 'XL',
    large: 'L',
    medium: 'M',
    small: 'S'
  }
  const offShieldKey = 'off_shield'

  blueprint.connections.forEach(conn => {
    const slotType = conn.slot_type

    conn.group.forEach(g => {
      // 主装备统计，按大小分组
      if (g.equipment_id) {
        const equip = store.findEquipment(g.equipment_id)
        if (!equip) return
        const size = equip.size
        if (!stats[slotType]) {
          stats[slotType] = {}
        }
        stats[slotType][size] = (stats[slotType][size] || 0) + g.count
      }
      // 副盾统计（护盾挂载在其他装备上），按大小分组
      if (g.shield && g.shield.equipment_id) {
        const shieldEquip = store.findEquipment(g.shield.equipment_id)
        if (!shieldEquip) return
        const shieldSize = shieldEquip.size
        if (!stats[offShieldKey]) {
          stats[offShieldKey] = {}
        }
        stats[offShieldKey][shieldSize] = (stats[offShieldKey][shieldSize] || 0) + g.shield.count
      }
    })
  })

  // 转换为显示字符串，按大小顺序 XL > L > M > S，副盾排最后
  const parts: string[] = []
  const sortedEntries = Object.entries(stats).sort(([a], [b]) => {
    if (a === offShieldKey) return 1
    if (b === offShieldKey) return -1
    return slotOrder.indexOf(a) - slotOrder.indexOf(b)
  })
  sortedEntries.forEach(([typeKey, sizeCounts]) => {
    // 将 off_shield 键转换为本地化名称
    const typeName = typeKey === offShieldKey ? t('shipBuild.shield_secondary') : getSlotTypeLabel(typeKey)
    sizeOrder.forEach(size => {
      const count = sizeCounts?.[size]
      if (count && count > 0) {
        parts.push(`${sizePrefix[size]}${typeName}x${count}`)
      }
    })
  })

  return parts.join(', ') || '-'
}

const getConnectionCount = (blueprint: ShipBlueprint) => {
  let count = 0
  blueprint.connections.forEach(conn => {
    count += conn.group.length
  })
  return count
}

const handleLoadBlueprint = (id: string) => {
  if (store.isDirty && store.blueprint) {
    if (!confirm(t('shipBuild.confirm_load_with_unsaved'))) {
      return
    }
  }
  store.loadBlueprint(id)
  emit('close')
}

const handleDeleteBlueprint = (id: string) => {
  if (store.isBuiltInBlueprintId(id)) return
  if (confirm(t('shipBuild.confirm_delete_blueprint'))) {
    store.deleteBlueprint(id)
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="dialog-backdrop">
    <div
      class="w-full max-w-3xl bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col max-h-[85vh] animate-fade-in">

      <div class="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-900/30">
        <h3 class="text-xl font-bold text-white tracking-wide flex items-center gap-2">
          <svg class="w-5 h-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          {{ t('shipBuild.load_blueprint') }}
        </h3>
        <button @click="$emit('close')"
          class="text-slate-400 hover:text-white transition p-1 hover:bg-slate-700 rounded">
          <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        <div v-if="blueprints.length === 0" class="text-center py-12 text-slate-500 italic">
          {{ t('shipBuild.no_saved_blueprints') }}
        </div>

        <div v-for="bp in blueprints" :key="bp.id"
          class="blueprint-item group bg-slate-700/40 border border-slate-600/50 rounded-md px-3 py-2 hover:border-blue-500/50 hover:bg-slate-700/60 transition-all duration-200">
          <div class="flex items-start justify-between gap-3 min-h-7">
            <div class="text-sm leading-6 text-slate-100 truncate">
              <span class="font-bold text-blue-100 group-hover:text-blue-400 transition-colors">{{ bp.name }}</span>
              <button
                class="ml-2 inline-flex align-middle"
                :title="bp.favorite ? t('shipBuild.fav_remove') : t('shipBuild.fav_add')"
                @click.stop="toggleFavoriteItem(bp.id)"
              >
                <svg v-if="bp.favorite" class="h-3.5 w-3.5 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <svg v-else class="h-3.5 w-3.5 text-slate-500 hover:text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            </div>
            <div class="text-xs text-slate-400 shrink-0 whitespace-nowrap">
              {{ getConnectionCount(bp) }} {{ t('shipBuild.connections_count') }}
              <template v-if="!store.isBuiltInBlueprintId(bp.id)">
                · {{ formatDate(bp.lastUpdated) }}
              </template>
            </div>
          </div>

          <div
            class="mt-1 text-sm text-slate-300 leading-6 bg-slate-800/45 px-2 py-1 rounded border border-slate-700/40 truncate">
            {{ getEquipmentStats(bp) }}
          </div>

          <div class="mt-2 pt-2 border-t border-slate-700/50 flex items-center gap-3">
            <button @click="handleLoadBlueprint(bp.id)"
              class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 px-3 py-1.5 rounded transition">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h6v6" />
                <path d="M10 14L21 3" />
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
              {{ t('shipBuild.action_load_blueprint') }}
            </button>

            <div class="flex-1" />

            <button v-if="!store.isBuiltInBlueprintId(bp.id)" @click="handleDeleteBlueprint(bp.id)"
              class="blueprint-delete-btn flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-900/30 px-3 py-1.5 rounded transition">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              {{ t('shipBuild.action_delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(30, 41, 59, 0.5);
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(71, 85, 105, 0.8);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 1);
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
