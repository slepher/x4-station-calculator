<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import type { ShipBlueprint } from '@/types/x4'
import { computed, watch } from 'vue'

const { translateShip, translateEquipmentType } = useX4I18n()

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits(['close'])
const { t } = useI18n()
const store = useShipBuildStore()

const formatDate = (ts: number) => new Date(ts).toLocaleString()

// Reload blueprints from storage when modal opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    store.loadBlueprintsFromStorage()
  }
})

const blueprints = computed(() => store.getBlueprintsForShip(store.selectedShipId))

const getShipName = (shipId: string) => {
  // 从 ships 数组中查找飞船并本地化
  const ship = store.ships.find(s => s.id === shipId)
  return ship ? translateShip(ship) : shipId
}

const getEquipmentStats = (blueprint: ShipBlueprint) => {
  // 按 slot_type + size 分组统计
  const stats: Record<string, Record<string, number>> = {}
  const sizeOrder = ['extralarge', 'large', 'medium', 'small']
  const sizePrefix: Record<string, string> = {
    extralarge: 'XL',
    large: 'L',
    medium: 'M',
    small: 'S'
  }
  const offShieldKey = 'off_shield'

  blueprint.connections.forEach(conn => {
    const slotType = conn.slot_type

    // 获取本地化的装备类型名称
    const equipmentType = store.equipmentTypes.find(et => et.id === slotType)
    const typeName = equipmentType ? translateEquipmentType(equipmentType) : slotType

    conn.group.forEach(g => {
      // 主装备统计，按大小分组
      if (g.equipment_id) {
        const equip = store.equipments.find(e => e.id === g.equipment_id)
        const size = equip?.size || 'medium'
        if (!stats[typeName]) {
          stats[typeName] = {}
        }
        stats[typeName][size] = (stats[typeName][size] || 0) + g.count
      }
      // 副盾统计（护盾挂载在其他装备上），按大小分组
      if (g.shield && g.shield.equipment_id) {
        const shieldEquip = store.equipments.find(e => e.id === g.shield!.equipment_id)
        const shieldSize = shieldEquip?.size || 'medium'
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
    return 0
  })
  sortedEntries.forEach(([typeKey, sizeCounts]) => {
    // 将 off_shield 键转换为本地化名称
    const typeName = typeKey === offShieldKey ? t('shipBuild.shield_secondary') : typeKey
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
  if (confirm(t('shipBuild.confirm_delete_blueprint'))) {
    store.deleteBlueprint(id)
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
          class="blueprint-item group bg-slate-700/40 border border-slate-600/50 rounded-md p-4 hover:border-blue-500/50 hover:bg-slate-700/60 transition-all duration-200">
          <div class="flex justify-between items-start mb-2">
            <div>
              <div class="font-bold text-lg text-blue-100 mb-1 group-hover:text-blue-400 transition-colors">{{
                bp.name }}</div>
              <div class="text-xs text-slate-500 font-mono">{{ formatDate(bp.lastUpdated) }}</div>
            </div>
            <div class="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
              {{ getConnectionCount(bp) }} {{ t('shipBuild.connections_count') }}
            </div>
          </div>

          <div class="space-y-1 mb-4">
            <div class="text-sm text-slate-300 leading-relaxed bg-slate-800/50 p-2 rounded border border-slate-700/50">
              {{ getShipName(bp.shipId) }}
            </div>
            <div class="text-sm text-slate-400 leading-relaxed bg-slate-800/50 p-2 rounded border border-slate-700/50">
              {{ getEquipmentStats(bp) }}
            </div>
          </div>

          <div class="flex items-center gap-3 pt-2 border-t border-slate-700/50">
            <button @click="handleLoadBlueprint(bp.id)"
              class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 px-3 py-1.5 rounded transition">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h6v6" />
                <path d="M10 14L21 3" />
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
              {{ t('shipBuild.action_load_blueprint') }}
            </button>

            <div class="flex-1"></div>

            <button @click="handleDeleteBlueprint(bp.id)"
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
