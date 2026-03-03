<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import CollapsibleDetailList from '@/components/common/CollapsibleDetailList.vue'
import PriceSlider from '@/components/common/PriceSlider.vue'
import type { X4Ship, X4Ware, X4Equipment, ShipBlueprint } from '@/types/x4'

const props = defineProps<{
  shipBlueprint: ShipBlueprint | null
}>()

const { t } = useI18n()
const { translateShip, translateWare, translateEquipment } = useX4I18n()

// 全局字典数据 - 直接从 store 读取
const store = useShipBuildStore()

// ============ 内部状态 ============
const materialMethod = ref('default')
const materialPriceMultiplier = ref(0.5)

// ============ Store 数据映射 ============
const wareMap = computed(() => {
  const map = new Map<string, X4Ware>()
  store.wares.forEach((ware) => {
    map.set(ware.id, ware)
  })
  return map
})

const shipMap = computed(() => {
  const map = new Map<string, X4Ship>()
  store.ships.forEach((ship) => {
    map.set(ship.id, ship)
  })
  return map
})

const equipmentMap = computed(() => {
  const map = new Map<string, X4Equipment>()
  store.equipments.forEach((eq) => {
    map.set(eq.id, eq)
  })
  return map
})

// ============ 从 Blueprint 派生数据 ============
const selectedShip = computed(() => {
  if (!props.shipBlueprint) return null
  return shipMap.value.get(props.shipBlueprint.shipId) || null
})

// ============ 计算辅助函数 ============
const getPriceByMultiplier = (ware: X4Ware, multiplier: number): number => {
  const basePrice = ware.price || 0
  return Math.round(basePrice * multiplier)
}

const resolveCostByMethod = (
  source: Record<string, Partial<Record<string, number>>> | undefined,
  method: string
): Partial<Record<string, number>> => {
  if (!source) return {}
  return source[method] || source.default || {}
}

const resolveShipCostByMethod = (ship: X4Ship, method: string): Record<string, number> => {
  const target = ship.production.find((item) => item.method === method)
    || ship.production.find((item) => item.method === 'default')
  return target?.cost || {}
}

const mapCostToMaterialItems = (
  cost: Partial<Record<string, number>>,
  quantity = 1
): Array<{ wareId: string; count: number; value: number }> => {
  return Object.entries(cost)
    .map(([wareId, rawCount]) => {
      const count = (rawCount || 0) * quantity
      const ware = wareMap.value.get(wareId)
      const unitPrice = ware ? getPriceByMultiplier(ware, materialPriceMultiplier.value) : 0
      return {
        wareId,
        count,
        value: count * unitPrice
      }
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      const wareA = wareMap.value.get(a.wareId)
      const wareB = wareMap.value.get(b.wareId)
      const tierA = wareA?.tier ?? 0
      const tierB = wareB?.tier ?? 0
      // 先按 tier 从高到低
      if (tierB !== tierA) return tierB - tierA
      // tier 相同则按英文 name 字母序从小到大
      const nameA = wareA?.name || a.wareId
      const nameB = wareB?.name || b.wareId
      return nameA.localeCompare(nameB)
    })
}

// ============ Material Groups 计算 ============
const materialMethodOptions = computed(() => {
  const options: string[] = []
  const optionSet = new Set<string>()

  // 从 ship production 获取方法
  selectedShip.value?.production.forEach((item) => {
    if (optionSet.has(item.method)) return
    if (item.method === 'xenon') return // Filter out xenon
    optionSet.add(item.method)
    options.push(item.method)
  })

  // 从 blueprint.connections 中的 equipment 获取方法
  props.shipBlueprint?.connections.forEach((conn) => {
    conn.group.forEach((g) => {
      // 主装备
      if (g.equipment_id) {
        const equipment = equipmentMap.value.get(g.equipment_id)
        if (equipment) {
          Object.keys(equipment.cost || {}).forEach((method) => {
            if (optionSet.has(method)) return
            if (method === 'xenon') return // Filter out xenon
            optionSet.add(method)
            options.push(method)
          })
        }
      }
      // 附带护盾
      if (g.shield && g.shield.equipment_id) {
        const shieldEquipment = equipmentMap.value.get(g.shield.equipment_id)
        if (shieldEquipment) {
          Object.keys(shieldEquipment.cost || {}).forEach((method) => {
            if (optionSet.has(method)) return
            if (method === 'xenon') return // Filter out xenon
            optionSet.add(method)
            options.push(method)
          })
        }
      }
    })
  })

  if (options.length === 0) {
    options.push('default')
  }
  return options
})

// 监听 methodOptions 变化，自动调整 materialMethod
if (materialMethodOptions.value.length > 0 && !materialMethodOptions.value.includes(materialMethod.value)) {
  materialMethod.value = materialMethodOptions.value[0] || 'default'
}

const shipMaterialGroup = computed(() => {
  if (!selectedShip.value) return null
  const shipCost = resolveShipCostByMethod(selectedShip.value, materialMethod.value)
  const items = mapCostToMaterialItems(shipCost)
  return {
    shipId: selectedShip.value.id,
    value: items.reduce((sum, item) => sum + item.value, 0),
    items
  }
})

const equipmentMaterialGroups = computed(() => {
  if (!props.shipBlueprint) return []

  const grouped = new Map<string, { equipment: X4Equipment; quantity: number }>()

  props.shipBlueprint.connections.forEach((conn) => {
    conn.group.forEach((g) => {
      // Handle main equipment
      if (g.equipment_id) {
        const equipment = equipmentMap.value.get(g.equipment_id)
        if (equipment) {
          const existing = grouped.get(g.equipment_id)
          if (existing) {
            existing.quantity += g.count
          } else {
            grouped.set(g.equipment_id, {
              equipment,
              quantity: g.count
            })
          }
        }
      }

      // Handle attached shield (stored in group.shield)
      if (g.shield && g.shield.equipment_id) {
        const shieldEquipment = equipmentMap.value.get(g.shield.equipment_id)
        if (shieldEquipment) {
          const existing = grouped.get(g.shield.equipment_id)
          if (existing) {
            existing.quantity += g.shield.count
          } else {
            grouped.set(g.shield.equipment_id, {
              equipment: shieldEquipment,
              quantity: g.shield.count
            })
          }
        }
      }
    })
  })

  const groups = Array.from(grouped.values()).map(({ equipment, quantity }) => {
    const equipmentCost = resolveCostByMethod(equipment.cost, materialMethod.value)
    const items = mapCostToMaterialItems(equipmentCost, quantity)
    return {
      equipmentId: equipment.id,
      equipmentName: translateEquipment(equipment),
      quantity,
      value: items.reduce((sum, item) => sum + item.value, 0),
      items
    }
  })

  return groups.sort((a, b) => a.equipmentName.localeCompare(b.equipmentName))
})

const materialSummaryItems = computed(() => {
  const grouped = new Map<string, { wareId: string; count: number; value: number }>()

  const mergeItems = (items: Array<{ wareId: string; count: number; value: number }>) => {
    items.forEach((item) => {
      const existing = grouped.get(item.wareId)
      if (existing) {
        existing.count += item.count
        existing.value += item.value
      } else {
        grouped.set(item.wareId, { ...item })
      }
    })
  }

  // Merge ship production cost
  if (shipMaterialGroup.value) {
    mergeItems(shipMaterialGroup.value.items)
  }
  // Merge equipment materials
  equipmentMaterialGroups.value.forEach((group) => mergeItems(group.items))

  return Array.from(grouped.values()).sort((a, b) => {
    const wareA = wareMap.value.get(a.wareId)
    const wareB = wareMap.value.get(b.wareId)
    const tierA = wareA?.tier ?? 0
    const tierB = wareB?.tier ?? 0
    // 先按 tier 从高到低
    if (tierB !== tierA) return tierB - tierA
    // tier 相同则按英文 name 字母序从小到大
    const nameA = wareA?.name || a.wareId
    const nameB = wareB?.name || b.wareId
    return nameA.localeCompare(nameB)
  })
})

const totalValue = computed(() => {
  return materialSummaryItems.value.reduce((sum, item) => sum + item.value, 0)
})

// ============ 模板数据 ============
const formatCrValue = (value: number) => `${new Intl.NumberFormat('en-US').format(Math.round(value))} Cr`
const formatMaterialCount = (count: number) => new Intl.NumberFormat('en-US').format(Math.round(count))

const getMaterialName = (wareId: string) => {
  const ware = wareMap.value.get(wareId)
  return ware ? translateWare(ware) : wareId
}

const getShipName = (shipId: string | undefined) => {
  if (!shipId) return ''
  const ship = shipMap.value.get(shipId)
  return ship ? translateShip(ship) : shipId
}
</script>

<template>
  <div class="col-span-12 lg:col-span-4 panel-card" data-testid="ship-build-panel-materials">
    <div class="panel-header">{{ t('ship_build.panel_materials') }}</div>
    <div class="material-panel" data-testid="ship-build-materials-panel">
      <div class="material-method-row">
        <label class="material-method-label" for="ship-build-material-method-select">
          {{ t('ship_build.material_method') }}
        </label>
        <select
          id="ship-build-material-method-select"
          v-model="materialMethod"
          class="material-method-select"
          data-testid="ship-build-material-method-select"
        >
          <option
            v-for="method in materialMethodOptions"
            :key="method"
            :value="method"
          >
            {{ method }}
          </option>
        </select>
      </div>

      <div class="material-groups custom-scrollbar">
        <CollapsibleDetailList
          :data="materialSummaryItems"
          main-row-testid="ship-build-material-summary"
          list-testid="ship-build-material-summary-list"
        >
          <template #title>
            <span class="material-summary-title">
              {{ t('ship_build.material_total') }}
            </span>
          </template>
          <template #header>
            <span class="material-summary-value">{{ formatCrValue(totalValue) }}</span>
          </template>
          <template #row="{ item }">
            <div class="material-item-row">
              <span class="material-item-count">{{ formatMaterialCount(item.count) }}</span>
              <span class="material-item-symbol">x</span>
              <span class="material-item-name">{{ getMaterialName(item.wareId) }}</span>
            </div>
            <span class="material-item-value">{{ formatCrValue(item.value) }}</span>
          </template>
        </CollapsibleDetailList>

        <!-- Ship production cost as separate item -->
        <CollapsibleDetailList
          v-if="shipMaterialGroup"
          :data="shipMaterialGroup.items"
          main-row-testid="ship-build-material-ship-group"
          list-testid="ship-build-material-ship-list"
        >
          <template #title>
            <div class="material-equipment-title">
              <span class="material-equipment-name">{{ getShipName(shipMaterialGroup?.shipId) }}</span>
              <span class="material-equipment-count">x 1</span>
            </div>
          </template>
          <template #header>
            <span class="material-summary-value">{{ formatCrValue(shipMaterialGroup?.value || 0) }}</span>
          </template>
          <template #row="{ item }">
            <div class="material-item-row">
              <span class="material-item-count">{{ formatMaterialCount(item.count) }}</span>
              <span class="material-item-symbol">x</span>
              <span class="material-item-name">{{ getMaterialName(item.wareId) }}</span>
            </div>
            <span class="material-item-value">{{ formatCrValue(item.value) }}</span>
          </template>
        </CollapsibleDetailList>

        <CollapsibleDetailList
          v-for="group in equipmentMaterialGroups"
          :key="group.equipmentId"
          :data="group.items"
          :main-row-testid="`ship-build-material-equipment-group-${group.equipmentId}`"
          :list-testid="`ship-build-material-equipment-list-${group.equipmentId}`"
        >
          <template #title>
            <div class="material-equipment-title">
              <span class="material-equipment-name">{{ group.equipmentName }}</span>
              <span class="material-equipment-count">x {{ group.quantity }}</span>
            </div>
          </template>
          <template #header>
            <span class="material-summary-value">{{ formatCrValue(group.value) }}</span>
          </template>
          <template #row="{ item }">
            <div class="material-item-row">
              <span class="material-item-count">{{ formatMaterialCount(item.count) }}</span>
              <span class="material-item-symbol">x</span>
              <span class="material-item-name">{{ getMaterialName(item.wareId) }}</span>
            </div>
            <span class="material-item-value">{{ formatCrValue(item.value) }}</span>
          </template>
        </CollapsibleDetailList>
      </div>

      <div class="material-footer" data-testid="ship-build-material-price-slider">
        <PriceSlider
          v-model="materialPriceMultiplier"
          :label="t('ship_build.material_price')"
          type="buy"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply flex items-center justify-between px-4 py-3 text-slate-200 text-sm font-semibold border-b border-slate-800/70 bg-slate-900/50;
}

.material-panel {
  @apply p-4 flex flex-col gap-3;
}

.material-method-row {
  @apply flex items-center justify-between gap-3;
}

.material-method-label {
  @apply text-[11px] uppercase tracking-wide text-slate-400 font-semibold;
}

.material-method-select {
  @apply bg-slate-900/70 border border-slate-700 text-slate-100 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-400;
}

.material-groups {
  @apply flex-1 overflow-y-auto pr-1;
}

.material-summary-title {
  @apply text-sm text-slate-200 font-semibold;
}

.material-summary-value {
  @apply text-xs text-red-300 font-mono font-semibold;
}

.material-item-row {
  @apply flex items-center gap-1 min-w-0;
}

.material-item-count {
  @apply text-xs text-slate-400 font-mono;
}

.material-item-symbol {
  @apply text-[10px] text-slate-500;
}

.material-item-name {
  @apply text-xs text-slate-300 truncate;
}

.material-item-value {
  @apply text-xs text-red-300/90 font-mono;
}

.material-equipment-title {
  @apply flex items-center gap-1 min-w-0;
}

.material-equipment-name {
  @apply text-xs text-slate-200 truncate;
}

.material-equipment-count {
  @apply text-xs text-slate-400 font-mono;
}

.material-footer {
  @apply mt-auto pt-2 border-t border-slate-800/80;
}
</style>
